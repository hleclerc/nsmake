import SourceMap from "./SourceMap"
import TaskFiber from "./TaskFiber"
import { pu }    from "./ArrayUtil"
import * as path from "path"
const js_tokens_matcher = require( "js-tokens" );
const typescript        = require( "typescript" );

export interface TypescriptCompilerArgs {
    no_implicit_any: boolean;
    js_env         : string;
    launch_dir     : string;
    define         : Array<string>;
    output         : string;
}

interface Comment {
    content: string;
    beg    : number;
    end    : number;
};

export
class ExeDataTypescriptParser {
    // requires             = new Array<Require>();
    // accepts              = new Array<Accept>();
    // define               = new Array<string>();
    // aliases              = new Array<{key:string,val:string}>();
    // js_content_is_new    = false;                                           /** if JsParser has modified the original js content */
    // pos_sharp_sourcemaps = new Array<Pss>();
    // sourcemap            = "";
    orig_name            = "";                                              /** name of the "leaf" input javascript/typescript/Typescript/... (i.e. the source) */
    // error                = false;
    // // data from nsmake cmds
    // html_content         = new Array<string>();
    // html_template        = null as string;
    // es_version           = null as string;                                  /** ecmascript version of the script */
    // need_hmr             = false;
    // ext_libs             = new Array<{ name: string, url: string, glob: string }>();
}

/** Typescript -> javascript
 */
export default
class TypescriptCompiler extends TaskFiber {
    exec( args: TypescriptCompilerArgs, done: ( err: boolean ) => void ) {
        // inputs
        const ts_name = this.children[ 0 ].outputs[ 0 ];
        const orig_name = this.children[ 0 ].exe_data.orig_name || ts_name;

        this.announcement( `tsc ${ ts_name}${ args.define.map( x => " -D" + x ).join( "" ) }` );

        // exe_data
        let exe_data = ( this.exe_data = new ExeDataTypescriptParser() ) as ExeDataTypescriptParser;
        exe_data.orig_name = orig_name;

        //
        let sourcemaps = new Map<string,SourceMap>();

        // compiler_host: set of function to replace system call by call to get_compilation_node, etc...
        let compiler_host = typescript.createCompilerHost( {} );

        compiler_host.getSourceFile = ( fileName: string, languageVersion, onError?: ( message: string ) => void ) => {
            let cn = this.get_filtered_target_sync( fileName, path.dirname( fileName ) );
            if ( ! cn ) {
                const spl = fileName.split( path.sep ), ind = spl.indexOf( "node_modules" );
                if ( ind >= 0 ) {
                    if ( spl[ ind + 1 ] == "@types" && ind + 2 < spl.length ) {
                        if ( this.run_install_cmd_sync( spl.slice( 0, ind ).join( path.sep ), [ "npm", "install", "@types/" + spl[ ind + 2 ] ], [] ) ) {
                            this.error( `Error: file '${ fileName }' not found, and installation procedure failed` );
                            return done( true );
                        }
                        cn = this.get_filtered_target_sync( fileName, path.dirname( fileName ) );
                        if ( ! cn )
                            this.error( `Error: file '${ fileName }' not found, even after installation of ${ spl[ ind + 2 ] }` );
                    }
                }
            }
            return cn ? typescript.createSourceFile( fileName, this.preprocessing( args, cn.name, cn.exe_data.orig_name || fileName ), languageVersion ) : undefined;
        };

        compiler_host.fileExists = ( fileName: string ): boolean => {
            return Boolean( this.get_filtered_target_signature_sync( fileName, path.dirname( fileName ) ) );
        };

        compiler_host.readFile = ( fileName: string ): string => {
            return this.read_file_sync( fileName ).toString();
        };

        compiler_host.resolveModuleNames = ( moduleNames: string[], containingFile: string ): any[] => {
            if ( moduleNames.length == 0 )
                return [];
            const res = this.get_requires_sync( [ { cwd: path.dirname( containingFile ), requires: moduleNames } ], args.js_env, true );
            const lst = this.get_cns_data_sync( res[ 0 ], true );
            return lst.map( ch => ch.outputs.length ? { resolvedFileName: ch.outputs[ 0 ] } : undefined );
        };

        //
        let compiler_options = {
            noEmitOnError: true,
            experimentalDecorators: true,
            noImplicitAny: args.no_implicit_any,
            target       : args.js_env.startsWith( "nodejs" ) ? typescript.ScriptTarget.Latest : typescript.ScriptTarget.ES2015,
            module       : typescript.ModuleKind.CommonJS,
            jsx          : typescript.JsxEmit.React,
            sourceMap    : true,
        };

        //
        let pr = typescript.createProgram( [ ts_name ], compiler_options, compiler_host ); //
        let sf = pr.getSourceFiles(), ws = sf[ sf.findIndex( x => x.fileName == ts_name ) ];

        let is_sourcemap = true, ts_sourcemap_data = null as string;
        let er = pr.emit( ws, ( fileName: string, data: string, writeByteOrderMark, onError ) => {
            if ( is_sourcemap ) {
                ts_sourcemap_data = data;
                is_sourcemap = false;
                return;
            }

            // outputs
            const nsm = args.output ? args.output + ".map" : this.new_build_file_sync( orig_name, ".js.map" );
            const njs = args.output || this.new_build_file_sync( orig_name, ".js" );
            this.outputs = [ njs, nsm ];

            // remove all //# sourceMappingURL=.... TODO: something context sensitive
            data = data.replace( /^\/\/# sourceMappingURL=.*/g, "" );
            data += `\n//# sourceMappingURL=${ path.relative( path.dirname( njs ), nsm ) }\n`;

            // add a tag to specify in which version of js the resulting file is
            const map_version = [];
            map_version[ typescript.ScriptTarget.ES3    ] = 3;
            map_version[ typescript.ScriptTarget.ES5    ] = 5;
            map_version[ typescript.ScriptTarget.ES6    ] = 6;
            map_version[ typescript.ScriptTarget.ES2015 ] = 2015;
            map_version[ typescript.ScriptTarget.ES2016 ] = 2016;
            map_version[ typescript.ScriptTarget.ES2017 ] = 2017;
            data += `\n//// nsmake es_version ${ map_version[ compiler_options.target ] || compiler_options.target }\n`;

            // save the generated content
            // let new_sourcemap = new SourceMap( data, path.dirname( ts_name ),  );
            // this.write_file_sync( nsm, new_sourcemap.toString( js_output, path.dirname( map_output ) ) );
            this.write_file_sync( nsm, ts_sourcemap_data );
            this.write_file_sync( njs, data );
        } );

        // ts.getPreEmitDiagnostics( pr ).concat( er.diagnostics ).forEach( diagnostic => {
        er.diagnostics.forEach( diagnostic => {
            if ( diagnostic.file ) {
                let { line, character } = diagnostic.file.getLineAndCharacterOfPosition( diagnostic.start );
                let file = diagnostic.file.fileName;

                // sourcefile correction
                // let item = sourcemap.find_item( line, character );
                // if ( item ) {
                //     line      = item.ol;
                //     character = item.oc;
                //     file      = sourcemap.sources[ item.of ];
                // }

                // sourcemap
                // let message = ts.flattenDiagnosticMessageText( `${ path.relative( cur_dir, file ) }(${ line + 1 },${ character + 1 }): error TS${ diagnostic.code }: ${ diagnostic.messageText }`, '\n' );
                let message: string;
                const beg_bold = ""; // "\u001b[1m";
                const end_bold = ""; // "\u001b[0m";
                if ( typeof diagnostic.messageText == 'string' )
                    message = `${ beg_bold }${ path.relative( args.launch_dir, file ) }(${ line + 1 },${ character + 1 }): error TS${ diagnostic.code }: ${ diagnostic.messageText }${ end_bold }\n`;
                else {
                    message = `${ beg_bold }${ path.relative( args.launch_dir, file ) }(${ line + 1 },${ character + 1 }):`;
                    for( let d = diagnostic.messageText; d; d = d.next )
                        message += ` error TS${ d.code }: ${ d.messageText }\n`;
                    message += end_bold;
                }
                message += this.src_err_msg( file, line, character );

                this.error( message )
            } else {
                this.error( `${ diagnostic.messageText } (error TS${ diagnostic.code }).` )
            }
        });

        done( er.diagnostics.length != 0 );
    }

    /** simplified preprocessing: typescript has to be valid also for IDEs... which only have non modified versions of the file.
     *  So, we focus on stuff that could change the requires */
    preprocessing( args: TypescriptCompilerArgs, fileName: string, orig_name: string ) : string {
        let src_content = this.read_file_sync( fileName ).toString();

        // parse
        const tokens = src_content.match( js_tokens_matcher );
        let comments = new Array<Comment>(), beg = 0; // only nsmake comments 
        for( let token of tokens ) {
            const m = token.match( /^\/\/\/\/[ \t]+nsmake[ \t]+(.*)/ );
            const n = token.match( /^\/\*\*\*[ \t]+nsmake[ \t]+(.*)\*\/$/ );
            if ( m ) {
                let end = beg + m[ 0 ].length;
                if ( src_content[ end ] == "\n" )
                    ++end;
                else if ( src_content.substr( end, 2 ) == "\r\n" )
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
            let global = false;
            if ( spl[ 0 ] == "global" ) {
                global = true;
                nspl.shift();
                if ( nspl.length == 0 ) {
                    this.error( `Error: 'nsmake global' without an additionnal keyword is not valid` );
                    continue;
                }
            }

            const cmd = spl[ nspl[ 0 ] ];
            switch ( cmd ) {
                case "ifndef":
                case "ifdef": {
                    // find the corresponding endif
                    let m = find_endif( n );
                    if ( m < 0 )
                        break; // we exit silently: the same error will occur during js parsing
                    //
                    const ind = args.define.indexOf( spl[ nspl[ 1 ] ] );
                    if ( spl[ 0 ] == "ifndef" ? ind >= 0 : ind < 0 ) {
                        to_remove.push({ beg: c.beg, end: comments[ m ].end });
                        comments.splice( n + 1, m - n );
                    } else {
                        comments.splice( m, 1 );
                    }
                    break;
                }
                case "uncomment_ifndef":
                case "uncomment_ifdef": {
                    // find the corresponding endif
                    let m = find_endif( n );
                    if ( m < 0 )
                        break; // we exit silently: the same error will occur during js parsing
                    //
                    const ind = args.define.indexOf( spl[ nspl[ 1 ] ] );
                    if ( cmd == "uncomment_ifdef" ? ind >= 0 : ind < 0 ) {
                        let d = comments[ m ], str = src_content.substring( c.end, d.beg );
                        const mc = str.match( /^([ \n\r\t]*)\/\*(.*)\*\//m );
                        if ( mc )
                            str = mc[ 1 ] + "  " + mc[ 2 ] + "  ";
                        else
                            str = str.split( "\n" ).map( x => x.replace( /^([ \t]*)\/\//, "$1  " ) ).join( "\n" );
                        src_content = src_content.substring( 0, c.beg ) + 
                                      src_content.substring( c.beg, c.end ).replace( /[^\n\r]/g, " " ) + 
                                      str + 
                                      src_content.substring( d.beg, d.end ).replace( /[^\n\r]/g, " " ) +
                                      src_content.substring( d.end );
                        comments.splice( n + 1, m - n ); // TODO: something more accurate !!
                    } else {
                        comments.splice( m, 1 );
                    }
                    break;
                }
                case "ext_lib":
                    if ( nspl.length != 4 )
                        this.error( "ext_lib expects exactly 3 arguments (name in requires, url, and name in the global/window space, e.g. '//// nsmake ext_lib react https://unpkg.com/react@15/dist/react.js React')" );
                    else
                        this.register_ext_lib( spl[ nspl[ 1 ] ], spl[ nspl[ 2 ] ], spl[ nspl[ 3 ] ] );
                    break;
                case "alias":
                    this.register_aliases( [ {
                        key: path.resolve( path.dirname( orig_name ), spl[ nspl[ 1 ] ] ),
                        val: path.resolve( path.dirname( orig_name ), cf( 2 ) )
                    } ] );
                    break;
                case "define":
                    if ( global ) {
                        if ( nspl.length == 1 ) {
                            this.error( `Error: 'define' requires at least one argument` );
                            break;
                        }
                        this.push_unique_in_global_arg_sync( "define", spl[ nspl[ 1 ] ] );
                    }
                    pu( args.define, cf( 1 ) );
                    break;
            }
        }

        //
        for( let rem of to_remove.reverse() )
            src_content = src_content.substring( 0      , rem.beg ) + 
                          src_content.substring( rem.beg, rem.end ).replace( /[^\n\r]/g, " " ) + 
                          src_content.substring( rem.end );

        return src_content;
    }

}
