import Task      from "./Task"
import * as path from "path" 

/**
 * return the "main" or "browser" file described in package.json
 */
// 
export default
class MainJsFromPackageJson extends Task {
    static attributes = [ "attribute", "public_dir" ];

    exec( args: { js_env: string, typescript: boolean } ) {
        const bext = args.typescript ? ".ts" : ".js";
        const name = this.children[ 0 ].outputs[ 0 ];        
        const cwd  = path.dirname( name );
        const json = JSON.parse( this.read_file_sync( name ).toString() );
        const attr = args.typescript ? "typings" : ( args.js_env == "browser" ? "browser" : "main" );
        const rout = json[ attr ] || ( args.typescript ? "index.d.ts" : ( json[ "main" ] || "index.js" ) );
        const aout = path.resolve( cwd, rout );
        const fout = this.get_filtered_target( aout, cwd, null, false ).name || 
            ( path.extname( aout ) == bext ? null : this.get_filtered_target( aout + bext, cwd, null, false ).name );
        if ( ! fout )
            throw `Impossible to find target '${ aout }' (mentionned in '${ name }' file)`;
        this.outputs = [ fout ];
    }
}

