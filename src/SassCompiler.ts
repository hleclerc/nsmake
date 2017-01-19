import TaskFiber from "./TaskFiber"
import * as path from "path"
const node_sass = require( "node-sass" );

export interface SassCompilerArgs {
    output: string;
}

export
class ExeDataSassParser {
    orig_name            = ""; /** name of the "leaf" input javascript/typescript/Sass/... (i.e. the source) */
}

/** Sass -> css
 */
export default
class SassCompiler extends TaskFiber {
    exec( args: SassCompilerArgs, done: ( boolean ) => void ) {
        // inputs
        const sass_name = this.children[ 0 ].outputs[ 0 ];
        const orig_name = this.children[ 0 ].exe_data.orig_name || sass_name;

        // exe_data
        let exe_data = this.exe_data = new ExeDataSassParser();
        exe_data.orig_name = orig_name;

        const ncss = args.output || this.new_build_file_sync( orig_name, ".css" );
        const nmap = args.output ? args.output + ".map" : this.new_build_file_sync( orig_name, ".css.map" );
        this.outputs = [ ncss, nmap ];

        this.announcement( `sass ${ sass_name } ${ ncss }` );

        // helper
        const ret_err = err => {
            this.error( `Error:${ orig_name }:${ err.toString() }` );
            return done( true );
        };

        // compile
        node_sass.render( {
            file     : sass_name,
            outFile  : ncss,
            sourceMap: nmap,
            importer : ( url, prev, importer_done ) => {
                const target = path.resolve( path.dirname( prev ), url );
                this.get_filtered_target( target, path.dirname( orig_name ), ( err, res ) => {
                    this.read_file( res.name, ( err, data ) => {
                        if ( err ) return ret_err( err );
                        importer_done( { contents: data.toString() } );
                    } );
                } );
            }
        }, ( err, output ) => {
            if ( err ) return ret_err( err );
            this.write_file( ncss, output.css, err => {
                if ( err ) return ret_err( err );
                this.write_file( nmap, output.map, err => {
                    if ( err ) return ret_err( err );
                    done( false );
                } )
            } );
        } );
    }
    
}
