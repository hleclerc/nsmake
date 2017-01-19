import Task       from "./Task"
import * as async from "async"
import * as path  from "path"
import * as glob  from "glob"
import * as fs    from "fs"

/**  */
export interface GtestArgs {
    entry_points      : Array<string>;
    args              : any;
    launch_dir        : string,
    color             : boolean,
}

export default
class Gtest extends Task {
    exec( args: GtestArgs, done: ( err: boolean ) => void ) {
        // we want to redo the call each time we relaunch the mission
        this.idempotent = false;

        // get, register and make the input compilation nodes
        async.reduce( args.entry_points, new Array<{name:string,signature:string}>(), ( cns, entry_point, cb_reduce ) => {
            glob( entry_point, { cwd: args.launch_dir }, ( err, matches ) => {
                if ( err ) { this.error( err.toString() ); return cb_reduce( true, null ); }
                async.map( matches, ( x, cb_map ) => {
                    this.get_filtered_target( path.resolve( args.launch_dir, x ), args.launch_dir, cb_map );
                }, ( err, lst: Array<{name:string,signature:string}> ) => {
                    cb_reduce( null, cns.concat( lst ) );
                } );
            } );
        }, ( err, cns ) => {
            if ( err ) return done( true );
            this.launch( args, done, cns );
        } );
    }

    /**  */
    launch( args: GtestArgs, done: ( err: boolean ) => void, cns: Array<{name:string,signature:string}> ) {
        let error = false;

        // creation of a config cpp file
        let content = "";
        content += `// a generated main for gtest\n`;
        content += `#include <gtest/gtest.h>\n`;
        content += `\n`;
        for( const cn of cns )
            content += `//// nsmake obj_name ${ cn.name }\n`;
        content += `\n`;
        content += `int main(int argc, char **argv) {\n`;
        content += `  ::testing::InitGoogleTest(&argc, argv);\n`;
        content += `  return RUN_ALL_TESTS();\n`;
        content += `}\n`;
        
        // run the cpp file
        this.run_mission_node( Object.assign( {}, args.args, {
            mission: "run",
            entry_point: 0,
        } ), [ this.make_signature( "MakeFile", [], {
            orig: cns.length ? path.basename( cns[ 0 ].name, path.extname( cns[ 0 ].name ) ) : "",
            ext: ".gtest.cpp",
            content,
        } ) ], ( err, res ) => {
            done( err );
        } );
    }
}
