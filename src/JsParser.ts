import JsLazySourceMap       from "./JsLazySourceMap"
import SourceMap, { coords } from "./SourceMap"
import { pu }                from "./ArrayUtil"
import Task                  from "./Task"
import * as bt               from "babel-types";
import * as babel            from "babel-core";
import * as yaml             from "js-yaml";
import * as path             from "path";
import * as fs               from "fs";
const js_tokens_matcher = require( "js-tokens" );

export
class Require {
    txt: string; /** ./foo */
    bin: number; /** begin instruction */
    bqu: number; /** begin quote (quote excluded) */
    equ: number; /** end quote (quote excluded) */
    ein: number; /** end instruction */
}

export
class Accept {
    txt: string; /** ./foo */
    bqu: number; /** begin quote (quote excluded) */
    equ: number; /** end quote (quote excluded) */
}

/** Pos sharp sourcemap */
export
class Pss {
    beg: number; /** ^//# ... */
    mid: number; /** //# sourcemap=^... */
    end: number; /** ...^ */
}

export
interface ArgsJsParser {
    js_env             : string;
    babel_env_arguments: string;
    target_browsers    : Array<string>,
    define             : Array<string>;
}

export
class ExeDataJsParser {
    requires             = new Array<Require>();
    accepts              = new Array<Accept>();
    define               = new Array<string>();
    needed_css           = new Array<string>();
    aliases              = new Array<{key:string,val:string}>();
    js_content_is_new    = false;                                           /** if JsParser has modified the original js content */
    pos_sharp_sourcemaps = new Array<Pss>();
    sourcemap            = "";
    orig_name            = "";                                              /** name of the "leaf" input javascript/typescript/Coffeescript/... (i.e. the source) */
    error                = false;
    // data from nsmake cmds
    html_content         = new Array<string>();
    html_template        = null as string;
    es_version           = null as string;                                  /** ecmascript version of the script */
    need_hmr             = false;
    ext_libs             = new Array<string>();
}

interface Comment {
    content: string;
    beg    : number;
    end    : number;
};

/** helper to find requires, accepts, .. */
function parser( js_parser: JsParser, exe_data: ExeDataJsParser, js_env: string ) {
    return function() {
        let stack_if = new Array<{ st: bt.Node, val: boolean }>();

        return {
            visitor: {
                Statement : {
                    enter( path ) {
                    },
                    exit( path ) {
                        if ( stack_if.length && stack_if[ stack_if.length - 1 ].st == path.node )
                            stack_if.pop();
                    },
                },
                IfStatement( path ) {
                    const expr = path.node as bt.IfStatement;
                    // typeof window !== "undefined" or equivalents
                    if ( expr.test.type == "BinaryExpression" && expr.test.left.type == "UnaryExpression" && expr.test.left.operator == "typeof" &&
                            expr.test.right.type == "StringLiteral" && expr.test.right.value == "undefined" && expr.test.left.argument.type == "Identifier" ) {
                        let neg = expr.test.operator == "!==" || expr.test.operator == "!=";
                        let pos = expr.test.operator == "===" || expr.test.operator == "==";
                        if ( neg || pos ) {
                            if ( ( expr.test.left as any ).argument.name == "process" ) {
                                if ( expr.alternate )
                                    stack_if.push( { st: expr.alternate, val: ( js_env.startsWith( "nodejs" ) ) !== neg } );
                                stack_if.push( { st: expr.consequent, val: ( js_env.startsWith( "nodejs" ) ) === neg } );
                            } else if ( ( expr.test.left as any ).argument.name == "window" ) {
                                if ( expr.alternate )
                                    stack_if.push( { st: expr.alternate, val: ( js_env.startsWith( "nodejs" ) ) === neg } );
                                stack_if.push( { st: expr.consequent, val: ( js_env.startsWith( "nodejs" ) ) !== neg } );
                            }
                        }
                    }
                },

                CallExpression( path ) {
                    const expr = path.node as bt.CallExpression;
                    if ( expr.callee.type == 'Identifier' ) {
                        if ( expr.callee.name == 'require' ) {
                            if ( stack_if.length && ! stack_if[ stack_if.length - 1 ].val )
                                return;
                            if ( path.scope.hasBinding( 'require' ) )
                                return;

                            if ( expr.arguments.length != 1 ) {
                                exe_data.error = true;
                                return js_parser.error( "`require` is expected to work with exactly 1 argument." );
                            }

                            const arg = expr.arguments[ 0 ];
                            switch ( arg.type ) {
                                case 'StringLiteral':
                                    exe_data.requires.push( {
                                        txt: arg.value,
                                        bin: expr.start,
                                        bqu: arg.start,
                                        equ: arg.end,
                                        ein: expr.end,
                                    } );
                                    return;
                                case 'TemplateLiteral':
                                    if ( arg.quasis.length > 1 || arg.expressions.length ) {
                                        exe_data.error = true;
                                        return js_parser.error( "TODO: `require` with complex template litterals." );
                                    }
                                    exe_data.requires.push( {
                                        txt: arg.quasis[ 0 ].value.cooked,
                                        bin: expr.start,
                                        bqu: arg.start,
                                        equ: arg.end,
                                        ein: expr.end,
                                    } );
                                    return;
                            }

                            return js_parser.info( `TODO nsmake: "require" with complex expressions (${ JSON.stringify( arg ) }).` );
                        }
                    } else if ( expr.callee.type == 'MemberExpression' ) {
                        if ( expr.callee.object.type == 'MemberExpression' && expr.callee.object.object.type == 'Identifier' &&
                                expr.callee.object.property.type == "Identifier" && expr.callee.property.type == 'Identifier' &&
                                expr.callee.object.object.name == 'module' && expr.callee.object.property.name == 'hot' &&
                                expr.callee.property.name == 'accept'
                                ) {
                            if ( stack_if.length && ! stack_if[ stack_if.length - 1 ].val )
                                return;

                            if ( expr.arguments.length != 2 )
                                return;

                            const arg = expr.arguments[ 0 ];
                            switch ( arg.type ) {
                                case 'StringLiteral':
                                    exe_data.accepts.push( {
                                        txt: arg.value,
                                        bqu: arg.start,
                                        equ: arg.end,
                                    } );
                                    return;
                                case 'TemplateLiteral':
                                    if ( arg.quasis.length > 1 || arg.expressions.length )
                                        return js_parser.error( "TODO: `module.hot.accept` with complex template litterals." );
                                    exe_data.accepts.push( {
                                        txt: arg.quasis[ 0 ].value.cooked,
                                        bqu: arg.start,
                                        equ: arg.end,
                                    } );
                                    return;
                            }

                            return js_parser.error( "TODO nsmake: `module.hot.accept` with complex expressions." );
                        }
                    }
                }
            }
        }
    }
}

/** executable or items args number => num in children
 */
export default
class JsParser extends Task {
    exec( args: ArgsJsParser ) {
        const js_name = this.children[ 0 ].outputs[ 0 ];
        const orig_name = this.children[ 0 ].exe_data.orig_name || js_name;

        // new exe_data, with first trivial arguments
        let exe_data = this.exe_data = new ExeDataJsParser();
        exe_data.orig_name = orig_name;

        // read file and sourcemap content for preprocessing. If sourcemap does not exist, we have to create one only if there are changes
        const sm = new JsLazySourceMap( this.read_file_sync( this.children[ 0 ].outputs[ 0 ] ).toString(), this.children[ 0 ].outputs[ 0 ] );
        const trans_list = new Array< { prog: string, args: string } >();
        this.preprocessing( args, trans_list, exe_data, sm, orig_name );

        // nsmake trans
        for( let trans of trans_list ) {
            const src = this.get_filtered_target( trans.prog, path.dirname( orig_name ) ).name;
            const ins = require( src ).default;
            ins( this, sm );
        }

        // babel presets
        let presets = new Array<any>();
        if ( args.babel_env_arguments || args.target_browsers.length ) {
            let ea = args.babel_env_arguments ? yaml.load( "{" + args.babel_env_arguments + "}" ) : {};
            if ( args.target_browsers.length ) {
                if ( ! ea.targets )
                    ea.targets = {};
                let lst = new Array<string>();
                for( let tb of args.target_browsers )
                    lst.push( ...tb.split( "," ).map( x => x.trim() ) );
                ea.targets.browsers = lst;
            }
            presets.push( [ "env", ea ] );
        }
        if ( path.extname( js_name ) == ".jsx" )
            presets.push( "react" );

        if ( presets.length ) {
            var nout = babel.transform( sm.src_content, {
                ast       : false,
                code      : true,
                sourceMaps: true,
                presets,
            } );

            let nsm = new SourceMap( nout.code, '', JSON.stringify( nout.map ) );
            sm.apply( nsm );
        }
        
        // get requires, accept, ...
        babel.transform( sm.src_content, {
            plugins   : [ parser( this, exe_data, args.js_env ) ],
            ast       : false,
            code      : false,
            sourceMaps: false,
        } );

        // save js and map files if necessary (if we had changes)
        if ( sm.has_changes ) {
            const nsm = this.new_build_file( orig_name, ".js.map" );
            const njs = this.new_build_file( orig_name, ".js" );
            
            sm.append( `\n//# sourceMappingURL=${ path.relative( path.dirname( njs ), nsm ) }` );
            this.write_file_sync( nsm, sm.toString( njs ) );
            this.write_file_sync( njs, sm.src_content );
            exe_data.js_content_is_new = true;
            this.outputs = [ njs, nsm ];
        } else {
            this.outputs = [ this.children[ 0 ].outputs[ 0 ] ];
        }

        // parse again the comments to find sourcemap indications
        let beg = 0;
        for( let token of sm.src_content.match( js_tokens_matcher ) ) {
            const sharp_sm_matcher = token.match( /^\/\/(#[ \t]+sourceMappingURL=)([^\n]+)/ );
            if ( sharp_sm_matcher ) {
                exe_data.pos_sharp_sourcemaps.push({ beg, mid: beg + sharp_sm_matcher[ 1 ].length, end: beg + sharp_sm_matcher[ 0 ].length });
                exe_data.sourcemap = path.resolve( path.dirname( this.outputs[ 0 ] ), sharp_sm_matcher[ 2 ] );
            }
            beg += token.length;
        }
    }

    /** read comments to find nsmake commands */
    preprocessing( args: ArgsJsParser, trans_list: Array<{ prog: string, args: string }>, exe_data: ExeDataJsParser, sm: JsLazySourceMap, orig_name: string ) {
        // parse
        const tokens = sm.src_content.match( js_tokens_matcher );
        let comments = new Array<Comment>(), beg = 0; // only nsmake comments 
        for( let token of tokens ) {
            const m = token.match( /^\/\/\/\/[ \t]+nsmake[ \t]+(.*)/ );
            const n = token.match( /^\/\*\*\*[ \t]+nsmake[ \t]+(.*)\*\/$/ );
            if ( m ) {
                let end = beg + m[ 0 ].length;
                if ( sm.src_content[ end ] == "\n" )
                    ++end;
                else if ( sm.src_content.substr( end, 2 ) == "\r\n" )
                    end += 2;
                comments.push({ content: m[ 1 ], beg, end });
            } else if ( n ) {
                let end = beg + n[ 0 ].length;
                comments.push({ content: n[ 1 ], beg, end });
            }
            beg += token.length;
        }

        // helper
        function find_endif( n: number ): number {
            for( let i = n + 1, nb_o = 1; i < comments.length; ++i ) {
                const d = comments[ i ], t = d.content.split( " " );
                if ( t[ 0 ] == "endif" ) {
                    if ( --nb_o == 0 )
                        return i;
                } else if ( t[ 0 ] == "ifdef" || t[ 0 ] == "ifndef" ) {
                    ++nb_o;
                }
            }
            return -1;
        }

        //
        let to_remove = new Array<{ beg: number, end: number }>();
        for( let n = 0; n < comments.length; ++n ) {
            const c = comments[ n ], spl = c.content.split( " " ), nspl = [ ...spl.keys() ].filter( x => spl[ x ].length );
            function cf( n: number ): string { return n < nspl.length ? spl.slice( nspl[ n ], nspl[ nspl.length - 1 ] + 1 ).join( " " ) : ""; }
            switch ( spl[ 0 ] ) {
                case "ifndef":
                case "ifdef":
                    this.note( `spl: ${ JSON.stringify( spl ) }` );
                    // find the corresponding endif
                    let m = find_endif( n );
                    if ( m < 0 ) {
                        const co = coords( sm.src_content, c.beg );
                        throw `Error:${ this.children[ 0 ].outputs[ 0 ] }:${ co.l + 1 }:${ co.c + 1 }: unterminated command '${ c.content }'`
                    }
                    //
                    const ind = args.define.indexOf( spl[ nspl[ 1 ] ] );
                    if ( spl[ 0 ] == "ifndef" ? ind >= 0 : ind < 0 ) {
                        to_remove.push({ beg: c.beg, end: comments[ m ].end });
                        comments.splice( n + 1, m - n );
                    } else {
                        comments.splice( m, 1 );
                    }
                    break;
                case "html_content":
                    exe_data.html_content.push( cf( 1 ) );
                    break;
                case "html_template":
                    exe_data.html_template = cf( 1 );
                    break;
                case "es_version":
                    exe_data.es_version = cf( 1 );
                    break;
                case "ext_lib":
                    if ( nspl.length == 4 ) {
                        this.register_ext_lib( spl[ nspl[ 1 ] ], spl[ nspl[ 2 ] ], spl[ nspl[ 3 ] ] );
                        exe_data.ext_libs.push( [ spl[ nspl[ 1 ] ], spl[ nspl[ 2 ] ], spl[ nspl[ 3 ] ] ].join( " " ) );
                    } else
                        this.error( "ext_lib expects exactly 3 arguments (name in requires, url, and name in the global/window space, e.g. '//// nsmake ext_lib react https://unpkg.com/react@15/dist/react.js React')" );
                    break;
                case "need_hmr":
                    exe_data.need_hmr = true;
                    break;
                case "define":
                    pu( exe_data.define, cf( 1 ) );
                    break;
                case "alias":
                    exe_data.aliases.push( { key: path.resolve( path.dirname( orig_name ), spl[ nspl[ 1 ] ] ), val: path.resolve( path.dirname( orig_name ), cf( 2 ) ) } );
                    break;
                case "trans":
                    trans_list.push( { prog: path.resolve( path.dirname( orig_name ), spl[ nspl[ 1 ] ] ), args: cf( 2 ) } );
                    break;
                case "css":
                    exe_data.needed_css.push( this.get_filtered_target_signature( path.resolve( path.dirname( orig_name ), cf( 1 ) ), path.dirname( orig_name ) ) );
                    break;
                default:
                    this.error( `Unknown nsmake cmd: '${ spl[ nspl[ 0 ] ] }'` );
            }
        }

        //
        for( let rem of to_remove.reverse() )
            sm.remove( rem.beg, rem.end );

        // NSMAKE_CMD/NSMAKE_RUN
        for( let num_token = 0, pos = 0; num_token < tokens.length; ++num_token ) {
            const token = tokens[ num_token ], beg = pos;
            pos += token.length;
            if ( token == "NSMAKE_CMD" || token == "NSMAKE_RUN" ) {
                // go to first '('
                const skip_beg = ( sub_tok: string ) => sub_tok == ' ' || sub_tok.startsWith( "/*" ) || sub_tok.startsWith( "//" );
                while ( ++num_token < tokens.length && skip_beg( tokens[ num_token ] ) )
                    pos += tokens[ num_token ].length;
                if ( num_token >= tokens.length )
                    break;
                if ( tokens[ num_token ] != '(' ) {
                    this.error( `Error: ${ token } is supposed to be followed by parenthesis (while parsing '${ orig_name }'). This command won't be substituted.` );
                    --num_token;
                    continue;
                }
                pos += tokens[ num_token ].length;

                // helper to get arguments
                const simp_arg = ( tl: Array<string> ) => {
                    while ( tl.length && skip_beg( tl[ 0 ] ) )
                        tl.shift();
                    while ( tl.length && skip_beg( tl[ tl.length - 1 ] ) )
                        tl.pop();
                    if ( tl.length == 1 && ( tl[ 0 ].startsWith( '"' ) || tl[ 0 ].startsWith( "'" ) || tl[ 0 ].startsWith( "`" ) ) )
                        tl[ 0 ] = tl[ 0 ].substring( 1, tl[ 0 ].length - 1 );
                    return tl.join( "" );
                };

                // get arguments
                let nb_opened = 1, tl = new Array<string>(), args = new Array<string>();
                for( ++num_token; num_token < tokens.length; ++num_token ) {
                    const sub_tok = tokens[ num_token ];
                    pos += sub_tok.length;
                    if ( sub_tok == ")" ) {
                        if( --nb_opened == 0 )
                            break;
                        tl.push( sub_tok );
                    } else if ( sub_tok == "(" ) {
                        tl.push( sub_tok );
                        ++nb_opened;
                    } else if ( sub_tok == "," ) {
                        if ( nb_opened == 1 ) {
                            args.push( simp_arg( tl ) );
                            tl.length = 0;
                        } else {
                            tl.push( sub_tok );
                        }
                    } else {
                        tl.push( sub_tok );
                    }
                }
                if ( tl.length )
                    args.push( simp_arg( tl ) );
                //
                const str = token == "NSMAKE_CMD" ?
                    this.nsmake_cmd( args, path.dirname( orig_name ), ".js", null, ".js" ) :
                    this.nsmake_run( args, path.dirname( orig_name ), ".js" );
                sm.replace( beg, pos, str );
                pos = beg + str.length;
            }
        }
    }
}
