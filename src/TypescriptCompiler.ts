import SourceMap from "./SourceMap"
import Task      from "./Task"
//import * as ts   from "typescript";
import * as path from "path"
const typescript = require( "typescript" );

export interface TypescriptCompilerArgs {
    no_implicit_any: boolean;
    js_env         : string;
    launch_dir     : string;
    nb_columns     : number;
}

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
class TypescriptCompiler extends Task {
    exec( args: TypescriptCompilerArgs ) {
        // inputs
        const ts_name = this.children[ 0 ].outputs[ 0 ], ts_data = this.read_file_sync( ts_name );
        const orig_name = this.children[ 0 ].exe_data.orig_name || ts_name;

        // exe_data
        let exe_data = ( this.exe_data = new ExeDataTypescriptParser() ) as ExeDataTypescriptParser;
        exe_data.orig_name = orig_name;

        //
        let sourcemaps = new Map<string,SourceMap>();

        // compiler_host: set of function to replace system call by call to get_compilation_node, etc...
        let compiler_host = typescript.createCompilerHost( {} );

        compiler_host.getSourceFile = ( fileName: string, languageVersion, onError?: ( message: string ) => void ) => {
            const name = this.get_filtered_target( fileName, path.dirname( fileName ) ).name;
            return typescript.createSourceFile( fileName, this.read_file_sync( name ).toString(), languageVersion );

        };

        compiler_host.fileExists = ( fileName: string ): boolean => {
            return Boolean( this.get_filtered_target_signature( fileName, path.dirname( fileName ) ) );
        };

        compiler_host.readFile = ( fileName: string ): string => {
            return this.read_file_sync( fileName ).toString();
        };

        compiler_host.resolveModuleNames = ( moduleNames: string[], containingFile: string ): any[] => {
            if ( moduleNames.length == 0 )
                return [];
            const res = this.get_requires( [ { cwd: path.dirname( containingFile ), requires: moduleNames } ], true );
            const lst = this.get_cns_data( res[ 0 ] );
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
            const nsm = this.new_build_file( orig_name, ".js.map" );
            const njs = this.new_build_file( orig_name, ".js" );
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
                // console.log( diagnostic.messageText );
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

                let nc = args.nb_columns, dc = nc >> 1, extr = this.read_file_sync( file ).toString( "utf8" ).split( "\n" )[ line ];

                // we start with character at the center of the screen.
                let b = character - dc;

                // but we don't want free space at the beginning
                if ( b <= 0 ) {
                    message += ( extr.length > nc ? extr.substr( 0, nc - 3 ) + "..." : extr ) + "\n";
                    message += " ".repeat( character ) + "^\n";
                } else {
                    message += "..." + ( extr.length - b > nc - 3 ? extr.substr( b, nc - 6 ) + "..." : extr.substr( b ) ) + "\n";
                    message += " ".repeat( dc + 3 ) + "^\n";
                }

                this.error( message )
            } else {
                this.error( `${ diagnostic.messageText } (error TS${ diagnostic.code }).` )
            }
        });

        if ( er.diagnostics.length )
            throw "";
    }
}
