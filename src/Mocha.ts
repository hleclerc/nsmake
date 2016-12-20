import Task       from "./Task"
import * as Moc   from "mocha"
import * as async from "async"
import * as path  from "path"
import * as glob  from "glob"
import * as fs    from "fs"

/** positive of null number -> reference to children. negative number => - reference to new_build_files - 1 */
export interface MochaArgs {
    entry_points  : Array<string>;
    args          : any;
    mocha         : string | number;
    mocha_reporter: string | number;
    launch_dir    : string
}

export default
class Mocha extends Task {
    static attributes = [ "args", "mocha", "reporter" ];

    exec( args: MochaArgs, done: ( err: boolean ) => void ) {
        // we want to redo the call each time we relaunch the mission
        this.pure_function = false;

        // check mocha installation
        if ( ! this.stat_sync( path.resolve( args.launch_dir, "node_modules", "@types", "mocha" ) ) )
            this.run_install_cmd( "npm", args.launch_dir, [ "npm", "install", "@types/mocha" ] );
        if ( ! this.stat_sync( path.resolve( args.launch_dir, "node_modules", "mocha" ) ) )
            this.run_install_cmd( "npm", args.launch_dir, [ "npm", "install", "mocha" ] );

        // helper to get arg values
        const av = ( n: string | number ): string => {
            return typeof n == 'string' ? n : this.children[ n ].outputs[ 0 ];
        };


        // get, register and make the input compilation nodes
        async.reduce( args.entry_points, new Array<string>(), ( cns, entry_point, cb_reduce ) => {
            glob( entry_point, { cwd: args.launch_dir }, ( err, matches ) => {
                if ( err ) { this.error( err.toString() ); return cb_reduce( true, null ); }
                // make a list of outputs
                const lst = matches.map( x => {
                    const sgn_entry_point = this.get_filtered_target( path.resolve( args.launch_dir, x ), args.launch_dir ).signature;
                    const nargs = Object.assign( {}, args.args, { mission: "exe", entry_point: 0 } );
                    const outputs = this.run_mission_node( nargs, [ sgn_entry_point ] );
                    return outputs[ 0 ];
                } );
                // append to the list
                cb_reduce( null, cns.concat( lst ) );
            } );
        }, ( err, cns ) => {
            if ( err ) return done( true );
            // call mocha
            this.spawn_sync( av( args.mocha ) || path.resolve( args.launch_dir, "node_modules", ".bin", "mocha" ), [ '-c', '--reporter', av( args.mocha_reporter ), ...cns ] );
            done( false );
        } );
    }
}
