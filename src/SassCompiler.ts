import Task      from "./Task"
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
class SassCompiler extends Task {
    exec( args: SassCompilerArgs, done: ( boolean ) => void ) {
        // inputs
        const sass_name = this.children[ 0 ].outputs[ 0 ];
        const orig_name = this.children[ 0 ].exe_data.orig_name || sass_name;

        // exe_data
        let exe_data = this.exe_data = new ExeDataSassParser();
        exe_data.orig_name = orig_name;

        const ncss = args.output || this.new_build_file( orig_name, ".css" );
        const nmap = args.output ? args.output + ".map" : this.new_build_file( orig_name, ".css.map" );
        this.outputs = [ ncss, nmap ];

        this.announcement( `sass ${ sass_name } ${ ncss }` );

        // compile
        node_sass.render( {
            file     : sass_name,
            outFile  : ncss,
            sourceMap: nmap,
        }, ( err, output ) => {
            if ( err ) {
                this.error( `Error:${ orig_name }:${ err.toString() }` );
                return done( true );
            }
            this.write_file( ncss, output.css, err => {
                if ( err ) { this.error( err.toString() ); return done( true ); }
                this.write_file( nmap, output.map, err => {
                    if ( err ) { this.error( err.toString() ); return done( true ); }
                    done( false );
                } )
            } );
        } );
    }
    
}
