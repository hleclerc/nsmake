import Task from "./Task"

/** positive of null number -> reference to children. negative number => - reference to new_build_files - 1 */
export interface MakeFileArgs {
    content: string;
    orig   : string;
    ext    : string;
}

/** create a file from a given content
 */
export default
class MakeFile extends Task {
    exec( args: MakeFileArgs, done: ( err: boolean ) => void ) {
        this.new_build_file( args.orig, args.ext, null, ( err, output ) => {
            if ( err ) return done( err );
            this.write_file( output, args.content, err => {
                this.outputs = [ output ];
                done( Boolean( err ) );
            } );
        } );
    }
}
