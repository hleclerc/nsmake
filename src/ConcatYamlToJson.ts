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
                if ( err_fr || ! fr )
                    return cb_dir( false );
                const dir = fr.name;
                this.read_dir( dir, ( err, content ) => {
                    if ( err ) return cb_dir( false );

                    async.forEachSeries( content, ( name, cb_cnt ) => {
                        // skip if not a .yam file
                        if ( ! name.toLowerCase().endsWith( ".yaml" ) )
                            return cb_cnt( null );
                        // a way to store the dependancy (and potentially handle code generation)
                        this.get_filtered_target( path.resolve( dir, name ), dir, ( err, ft ) => {
                            if ( err )
                                return cb_cnt( null );
                            this.read_file( ft.name, ( err, str ) => {
                                try {
                                    const data = yaml.safeLoad( str.toString() );
                                    res.push( { name: path.join( dir, name ), data } );
                                } catch ( e ) {
                                    this.error( `Error:${ path.join( dir, name ) }:${ e }` );
                                }
                                cb_cnt( null );
                            } );
                        } );
                    }, err => cb_dir( false ) );
                } );
            } );
        }, ( err: boolean ) => {
            if ( err )
                return done( err );
            const out = this.new_build_file( `concat-yaml`, ".json", null, ( err, out ) => {
                if ( err ) return done( true );
                this.write_file( out, JSON.stringify( res ), ( err ) => {
                    if ( err ) return done( true );
                    this.outputs = [ out ];
                    done( false );
                } );
            } );
        } );
    }
}
