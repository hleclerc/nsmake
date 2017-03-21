import Task from "./Task"

/** 
 */
export default
class MissionOutput extends Task {
    exec( args, done: ( err: boolean ) => void ) {
        this.get_filtered_target_signatures( args.targets, args.cwd, ( err, sgns ) => {
            if ( err )
                return done( err );
            this.run_mission_node( args.args, sgns, ( err, res ) => {
                if ( err )
                    return done( err );
                this.outputs = [ res.outputs[ args.ind ] ];
                done( false );
            } );
        } );
    }
}
