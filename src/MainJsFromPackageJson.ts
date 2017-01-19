import Task      from "./Task"
import * as path from "path" 

/**
 * return the "main" or "browser" file described in package.json
 */
// 
export default
class MainJsFromPackageJson extends Task {
    exec( args: { js_env: string, typescript: boolean }, done: ( err: boolean ) => void ) {
        const bext = args.typescript ? ".ts" : ".js";
        const name = this.children[ 0 ].outputs[ 0 ];        
        const cwd  = path.dirname( name );
        this.read_file( name, ( err, data ) => {
            if ( err )
                return this.error( err.toString() ), done( true );
            try {
                const json = JSON.parse( data.toString() );
                const attr = args.typescript ? "typings" : ( args.js_env == "browser" ? "browser" : "main" );
                const rout = json[ attr ] || ( args.typescript ? "index.d.ts" : ( json[ "main" ] || "index.js" ) );
                const aout = path.resolve( cwd, rout );

                // look for target `aout`, or `aout`.[js|ts]
                this.get_filtered_target( aout, cwd, ( err, res ) => {
                    if ( err || ! res ) {
                        if ( path.extname( aout ) == bext )
                            return this.error( `Impossible to find target '${ aout }' (mentionned in '${ name }' file)` ), done( true );
                        return this.get_filtered_target( aout + bext, cwd, ( err, res ) => {
                            if ( err || ! res )
                                return this.error( `Impossible to find target '${ aout }' (mentionned in '${ name }' file)` ), done( true );
                            this.outputs = [ res.name ];
                            done( false );
                        } );
                    }
                    this.outputs = [ res.name ];
                    done( false );
                } );
            } catch ( err ) {
                return this.error( err.toString() ), done( true );
            }
        } )

    }
}

