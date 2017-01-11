import Task       from "./Task"
import * as yaml  from "js-yaml";
import * as async from "async";
import * as path  from "path";

/** positive of null number -> reference to children. negative number => - reference to new_build_files - 1 */
export interface ConcatYamlToJsonArgs {
    directories: Array<string>;
}

/** read .yaml files in directory(ies) specified by children, concatenate the result in a json with
 *   name: name of the .yaml file
 *   data: data in the .yaml file
 */
export default
class ConcatYamlToJson extends Task {
    exec( args: ConcatYamlToJsonArgs, done: ( err: boolean ) => void ) {
        let res = new Array<any>();
        async.forEachSeries( args.directories, ( target, cb_dir ) => {
            this.get_filtered_target( target, target, ( err_fr: boolean, fr ) => {
                if ( fr && ! err_fr ) {
                    const dir = fr.name;
                    for( let name of this.read_dir_sync( dir ) ) {
                        if ( name.toLowerCase().endsWith( ".yaml" ) ) {
                            const data = yaml.safeLoad( this.read_file_sync( 
                                this.get_filtered_target( path.resolve( dir, name ), dir ).name // a way to store the dependancy
                            ).toString() );
                            res.push( { name: path.join( dir, name ), data } );
                        }
                    }
                }
                cb_dir( false );
            } );
        }, ( err: boolean ) => {
            if ( err )
                return done( err );
            const out = this.new_build_file( `concat-yaml`, ".json" );
            this.write_file_sync( out, JSON.stringify( res ) );
            this.outputs = [ out ];
            done( false );
        } );
    }
}
