import Task from "./Task"

/** Takes the parsed command line argument to run what is asked
 * The goal of this task is mainly to tranform arguments to something compatible for `run_mission_node` (which expects numbers for references to signatures...)
 * Example: {"mission":"run","entry_point":".../src.js","_cns":["entry_point"]} to parse and run src.js 
 */
export default
class MissionMaker extends Task {
    exec( args, done: ( err: boolean ) => void ) {
        // get compilation nodes signatures if not done
        let scn = { _cns: [] } as any, targets = new Array<string>();
        for( let attr of args._cns || [] ) {
            scn[ attr ] = targets.length;
            targets.push( args[ attr ] );
        } 

        // find and run the mission node
        this.get_filtered_target_signatures( targets, args.cwd, ( err, signatures ) => {
            if ( err )
                return done( true );
            if ( signatures.some( x => ! x ) ) {
                for( let num = 0; num < targets.length; ++num )
                    if ( ! signatures[ num ] )
                        this.error( `Don't known how to read or build '${ targets[ num ] }'` );
                return done( true );
            }
            this.run_mission_node( Object.assign( {}, args, scn ), signatures, ( err, cn_data ) => {
                if ( err ) return done( true );
                this.outputs = cn_data.outputs;
                done( false );
            } );
        } );
    }
}
