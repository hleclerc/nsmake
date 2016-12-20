import Task      from "./Task"
import * as yaml from "js-yaml";
import * as path from "path";

/** positive of null number -> reference to children. negative number => - reference to new_build_files - 1 */
export interface ConcatYamlToJsonArgs {
}

/** executable or items args number => num in children
 */
export default
class ConcatYamlToJson extends Task {
    exec( args: ConcatYamlToJsonArgs ) {
        let res = new Array<any>();
        for( let ch of this.children ) {
            const dir = ch.outputs[ 0 ];
            for( let name of this.read_dir_sync( dir ) ) {
                if ( name.toLowerCase().endsWith( ".yaml" ) ) {
                    res.push( yaml.safeLoad( this.read_file_sync( 
                        this.get_filtered_target( path.resolve( dir, name ), dir ).name
                    ).toString() ) );
                }
            }
        }

        const out = this.new_build_file( `concat-yaml`, ".json" );
        this.write_file_sync( out, JSON.stringify( res ) );
        this.outputs = [ out ];
    }
}
