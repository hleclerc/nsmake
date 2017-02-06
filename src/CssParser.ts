import JsLazySourceMap       from "./JsLazySourceMap"
import SourceMap, { coords } from "./SourceMap"
import { pu }                from "./ArrayUtil"
import TaskFiber             from "./TaskFiber"
import * as path             from "path";
import * as fs               from "fs";
const css_tokens_matcher = require( "css-tokens" ).default;

export
class Url {
    sgn: string; /** compilation node signature */
    bin: number; /** begin input data (quote included if there's any) */
    bqu: number; /** begin quote (quote excluded) */
    equ: number; /** end quote (quote excluded) */
    ein: number; /** end input data (quote included if there's any) */
}

export
interface ArgsCssParser {
    js_env             : string;
    babel_env_arguments: string;
    target_browsers    : Array<string>,
    define             : Array<string>;
}

/** Pos sharp sourcemap */
class Pss {
    beg: number; /** ^//# ... */
    mid: number; /** //# sourcemap=^... */
    end: number; /** ...^ */
}

export
class ExeDataCssParser {
    orig_name            = "";                                              /** name of the "leaf" input javascript/typescript/Coffeescript/... (i.e. the source) */
    css_content_is_new   = false;                                           /** if CssParser has modified the original js content */
    urls                 = new Array<Url>();
    sourcemap            = "";
    aliases              = new Array<{key:string,val:string}>();
    pos_sharp_sourcemaps = new Array<Pss>();
    html_content         = new Array<string>();
    define               = new Array<string>();

    // needed_css           = new Array<string>();
    // error                = false;
    // // data from nsmake cmds
    // html_template        = null as string;
    // es_version           = null as string;                                  /** ecmascript version of the script */
    // need_hmr             = false;
}

interface Comment {
    content: string;
    beg    : number;
    end    : number;
};

/** executable or items args number => num in children
 */
export default
class CssParser extends TaskFiber {
    exec( args: ArgsCssParser, done: ( err: boolean ) => void ) {
        const css_name = this.children[ 0 ].outputs[ 0 ];
        const orig_name = this.children[ 0 ].exe_data.orig_name || css_name;

        // new exe_data, with first trivial arguments
        let exe_data = this.exe_data = new ExeDataCssParser();
        exe_data.orig_name = orig_name;

        // read file and sourcemap content for preprocessing. If sourcemap does not exist, we have to create one only if there are changes
        const sm = new JsLazySourceMap( this.read_file_sync( this.children[ 0 ].outputs[ 0 ] ).toString(), this.children[ 0 ].outputs[ 0 ] );
        const trans_list = new Array< { prog: string, args: string } >();
        this.preprocessing( args, trans_list, exe_data, sm, orig_name );

        // nsmake trans
        for( let trans of trans_list ) {
            const src = this.get_filtered_target_sync( trans.prog, path.dirname( orig_name ) ).name;
            const ins = require( src ).default;
            ins( this, sm );
        }

        // find `url` tokens
        this.get_url_and_sm_tokens( args, exe_data, sm, orig_name );

        // save css and map files if necessary (if we had changes)
        if ( sm.has_changes ) {
            const njs = this.new_build_file_sync( orig_name, ".css" );
            const nsm = this.new_build_file_sync( njs, ".css.map" );
            
            sm.append( `\n//# sourceMappingURL=${ path.relative( path.dirname( njs ), nsm ) }` );
            this.write_file_sync( nsm, sm.toString( njs ) );
            this.write_file_sync( njs, sm.src_content );
            exe_data.css_content_is_new = true;
            this.outputs = [ njs, nsm ];
        } else {
            this.outputs = [ this.children[ 0 ].outputs[ 0 ] ];
        }

        done( false );
    }

    /** read comments to find nsmake commands */
    preprocessing( args: ArgsCssParser, trans_list: Array<{ prog: string, args: string }>, exe_data: ExeDataCssParser, sm: JsLazySourceMap, orig_name: string ) {
        // parse
        const tokens = sm.src_content.match( css_tokens_matcher );
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
                case "define":
                    pu( exe_data.define, cf( 1 ) );
                    break;
                case "html_content":
                    exe_data.html_content.push( cf( 1 ) );
                    break;
                case "alias":
                    exe_data.aliases.push( { key: path.resolve( path.dirname( orig_name ), spl[ nspl[ 1 ] ] ), val: path.resolve( path.dirname( orig_name ), cf( 2 ) ) } );
                    break;
                case "trans":
                    trans_list.push( { prog: path.resolve( path.dirname( orig_name ), spl[ nspl[ 1 ] ] ), args: cf( 2 ) } );
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
                    this.nsmake_cmd_sync( args, path.dirname( orig_name ), ".js", ".js" ) :
                    this.nsmake_run_sync( args, path.dirname( orig_name ), ".js" );
                sm.replace( beg, pos, str );
                pos = beg + str.length;
            }
        }
    }

    get_url_and_sm_tokens( args: ArgsCssParser, exe_data: ExeDataCssParser, sm: JsLazySourceMap, orig_name: string ): void {
        // css_tokens_matcher handle differently url(smurf) and url("smurf")
        const tokens = sm.src_content.match( css_tokens_matcher );
        for( let n = 0; n < tokens.length; ++n ) {
            const token = tokens[ n ];
            if ( token.startsWith( "url(" ) && token.endsWith( ")" ) ) {
                const txt = token.substring( 4, token.length - 1 );
                const msp = txt.match( /( *)(.*)( *)/ );
                const lst = [];
                if ( msp[ 1 ] )
                    lst.push( msp[ 1 ] );
                lst.push( msp[ 2 ] );
                if ( msp[ 3 ] )
                    lst.push( msp[ 3 ] );
                tokens.splice( n, 1, "url", "(", ...lst, ")" );
                n += 1 + lst.length;
            }
        }
        
        for( let num_token = 0, pos = 0; num_token < tokens.length; ++num_token ) {
            const token = tokens[ num_token ];
            pos += token.length;

            if ( token == "@import" ) {
                const skip_beg = ( sub_tok: string ) => sub_tok == ' ' || sub_tok.startsWith( "/*" ) || sub_tok.startsWith( "//" );
                while ( ++num_token < tokens.length && skip_beg( tokens[ num_token ] ) )
                    pos += tokens[ num_token ].length;
                if ( num_token >= tokens.length )
                    break;
                
                // register the url 
                const txt = tokens[ num_token ];
                if ( `'"`.indexOf( txt[ 0 ] ) >= 0 ) {
                    const arg = txt.substring( 1, txt.length - 1 );
                    exe_data.urls.push( {
                        sgn: this.get_filtered_target_signature_sync( path.resolve( path.dirname( orig_name ), arg ), path.dirname( orig_name ) ),
                        bin: pos,
                        bqu: pos + 1,                     
                        equ: pos + txt.length - 1, 
                        ein: pos + txt.length
                    } );
                    pos += txt.length;
                } else
                    --num_token;
            } else if ( token == "url" ) {
                // go to first '('
                const skip_beg = ( sub_tok: string ) => sub_tok == ' ' || sub_tok.startsWith( "/*" ) || sub_tok.startsWith( "//" );
                while ( ++num_token < tokens.length && skip_beg( tokens[ num_token ] ) )
                    pos += tokens[ num_token ].length;
                if ( num_token >= tokens.length )
                    break;
                if ( tokens[ num_token ] != '(' ) {
                    this.error( `Error: ${ token } is supposed to be followed by parenthesis (while parsing '${ orig_name }').` );
                    --num_token;
                    continue;
                }
                pos += tokens[ num_token ].length;
                let bqu = pos, bin = pos, din = 0;

                // helper to get arguments
                const simp_arg = ( tl: Array<string> ) => {
                    while ( tl.length && skip_beg( tl[ 0 ] ) ) {
                        bqu += tl[ 0 ].length;
                        bin += tl[ 0 ].length;
                        tl.shift();
                    }
                    while ( tl.length && skip_beg( tl[ tl.length - 1 ] ) )
                        tl.pop();
                    if ( tl.length == 1 && ( tl[ 0 ].startsWith( '"' ) || tl[ 0 ].startsWith( "'" ) || tl[ 0 ].startsWith( "`" ) ) ) {
                        tl[ 0 ] = tl[ 0 ].substring( 1, tl[ 0 ].length - 1 );
                        bqu += 1;
                        din = 1;
                    }
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
                if ( args.length != 1 ) {
                    this.error( `Error:${ orig_name }: 'url' is supposed to be followed by exactly 1 argument.` );
                    continue;
                }
                exe_data.urls.push( {
                    sgn: this.get_filtered_target_signature_sync( path.resolve( path.dirname( orig_name ), args[ 0 ] ), path.dirname( orig_name ) ),
                    bin,
                    bqu,                              
                    equ: bqu + args[ 0 ].length,      
                    ein: bqu + args[ 0 ].length + din 
                } );
            } else {
                const sharp_sm_matcher = token.match( /^\/\*(#[ \t]+sourceMappingURL=)([^\n]+)[ \t]+\*\// );
                if ( sharp_sm_matcher ) {
                    const beg = pos - token.length;
                    exe_data.pos_sharp_sourcemaps.push({ beg, mid: beg + sharp_sm_matcher[ 1 ].length, end: beg + sharp_sm_matcher[ 0 ].length });
                    exe_data.sourcemap = path.resolve( path.dirname( this.children[ 0 ].outputs[ 0 ] ), sharp_sm_matcher[ 2 ] );
                }
            }
        }
        // this.note( `exe_data: ${ JSON.stringify( exe_data.urls.map( x => sm.src_content.substring( x.bin, x.ein ) ) ) }` );
        // this.note( `exe_data: ${ JSON.stringify( exe_data.urls.map( x => sm.src_content.substring( x.bqu, x.equ ) ) ) }` );
        // this.note( `exe_data: ${ JSON.stringify( exe_data.urls.map( x => x.sgn ) ) }` );
    }
}

