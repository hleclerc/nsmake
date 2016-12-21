import Task      from "./Task"
import * as path from "path"
var cs = require( "coffee-script" );

export interface CoffeescriptCompilerArgs {
    output: string;
}

export
class ExeDataCoffeescriptParser {
    // requires             = new Array<Require>();
    // accepts              = new Array<Accept>();
    // define               = new Array<string>();
    // aliases              = new Array<{key:string,val:string}>();
    // js_content_is_new    = false;                                           /** if JsParser has modified the original js content */
    // pos_sharp_sourcemaps = new Array<Pss>();
    // sourcemap            = "";
    orig_name            = "";                                              /** name of the "leaf" input javascript/typescript/Coffeescript/... (i.e. the source) */
    // error                = false;
    // // data from nsmake cmds
    // html_content         = new Array<string>();
    // html_template        = null as string;
    // es_version           = null as string;                                  /** ecmascript version of the script */
    // need_hmr             = false;
    // ext_libs             = new Array<{ name: string, url: string, glob: string }>();
}

/** Coffeescript -> javascript
 */
export default
class CoffeescriptCompiler extends Task {
    exec( args: CoffeescriptCompilerArgs ) {
        // inputs
        const cs_name = this.children[ 0 ].outputs[ 0 ], cs_data = this.read_file_sync( cs_name );
        const orig_name = this.children[ 0 ].exe_data.orig_name || cs_name;

        // exe_data
        let exe_data = ( this.exe_data = new ExeDataCoffeescriptParser() ) as ExeDataCoffeescriptParser;
        exe_data.orig_name = orig_name;

        // tokenize to get the nsmake cmds
        const tl = cs.tokens( cs_data.toString( 'utf8' ) );
        let nsmake_comments = new Array<string>(); // , sm_name = '', pss = new Array<number>();
        if ( tl ) {
            for( const tok of tl ) {
                if ( tok[ 0 ] == 'HERECOMMENT' ) {
                    const nsmake_matcher = tok[ 1 ].match( /^\s+nsmake\s+([^\n]+)/ );
                    if ( nsmake_matcher )
                        nsmake_comments.push( nsmake_matcher[ 1 ] );
                }
            }
        }

        // compile
        const cmp = cs.compile( cs_data.toString( 'utf8' ), {
            filename : cs_name,
            sourceMap: true,
            bare     : true,
        } );

        // re-add nsmake comments
        if ( nsmake_comments.length ) { 
            if ( cmp.js[ cmp.js.length - 1 ] != '\n' )
                cmp.js += '\n'
            for( let ns of nsmake_comments ) 
                cmp.js += `//// nsmake ${ ns }\n`;
        }

        // save content
        const nsm = args.output ? args.output + ".map" : this.new_build_file( orig_name, ".js.map" );
        const njs = args.output || this.new_build_file( orig_name, ".js" );

        cmp.js += `\n//# sourceMappingURL=${ path.relative( path.dirname( njs ), nsm ) }`;
        this.write_file_sync( nsm, cmp.v3SourceMap );
        this.write_file_sync( njs, cmp.js );
        this.outputs = [ njs, nsm ];
    }
}
