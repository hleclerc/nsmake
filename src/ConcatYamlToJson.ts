import Task      from "./Task"
import * as yaml from "js-yaml";
import * as path from "path";

/** positive of null number -> reference to children. negative number => - reference to new_build_files - 1 */
export interface ConcatYamlToJsonArgs {
}

/** read .yaml files in directory(ies) specified by children, concatenate the result in a json with
 *   name: name of the .yaml file
 *   data: data in the .yaml file
 */
export default
class ConcatYamlToJson extends Task {
    exec( args: ConcatYamlToJsonArgs ) {
        let res = new Array<any>();
        for( let ch of this.children ) {
            const dir = ch.outputs[ 0 ];
            for( let name of this.read_dir_sync( dir ) ) {
                if ( name.toLowerCase().endsWith( ".yaml" ) ) {
                    const data = yaml.safeLoad( this.read_file_sync( 
                        this.get_filtered_target( path.resolve( dir, name ), dir ).name
                    ).toString() );
                    res.push( { name, data } );
                }
            }
        }

        const out = this.new_build_file( `concat-yaml`, ".json" );
        this.write_file_sync( out, JSON.stringify( res ) );
        this.outputs = [ out ];
    }
}
