import Task from "./Task"

/** positive of null number -> reference to children. negative number => - reference to new_build_files - 1 */
export interface DegradatorArgs {
    target: string;
    viewed: Array<string>;
}

/** Degradatable or items args number => num in children
 */
export default
class Degradator extends Task {
    exec( args: DegradatorArgs, done: ( err: boolean ) => void ) {
        this.idempotent = false;

        // find substitution if necessary
        this.get_substitution_for_time_limit( args.target, args.viewed, sgn => {
            // execution
            this.get_cn_data( sgn, ( err, res ) => {
                this.exe_data = res.exe_data;
                this.outputs = res.outputs;
                done( err );
            } );
        } );
    }
}
