import Task       from "./Task"
import * as Moc   from "mocha"
import * as async from "async"
import * as path  from "path"
import * as glob  from "glob"
import * as fs    from "fs"

/** positive of null number -> reference to children. negative number => - reference to new_build_files - 1 */
export interface MochaArgs {
    target_testing_env: Array<string>;
    entry_points      : Array<string>;
    args              : any;
    mocha             : string | number;
    mocha_reporter    : string | number;
    launch_dir        : string,
    color             : boolean,
}

export default
class Mocha extends Task {
    exec( args: MochaArgs, done: ( err: boolean ) => void ) {
        // we want to redo the call each time we relaunch the mission
        this.pure_function = false;

        // check mocha installation
        if ( ! this.av( args.mocha ) ) {
            try { this.stat( path.resolve( args.launch_dir, "node_modules", "@types", "mocha" ) ); }
            catch ( e ) { this.run_install_cmd( "", args.launch_dir, [ "npm", "install", "@types/mocha" ], [] ); } 
            try { this.stat( path.resolve( args.launch_dir, "node_modules", "mocha" ) ); }
            catch ( e ) { this.run_install_cmd( "", args.launch_dir, [ "npm", "install", "mocha" ], [] ); }
        }

        // get, register and make the input compilation nodes
        async.reduce( args.entry_points, new Array<string>(), ( cns, entry_point, cb_reduce ) => {
            glob( entry_point, { cwd: args.launch_dir }, ( err, matches ) => {
                if ( err ) { this.error( err.toString() ); return cb_reduce( true, null ); }
                // make a list of outputs
                const lst = matches.map( x => {
                    const sgn_entry_point = this.get_filtered_target( path.resolve( args.launch_dir, x ), args.launch_dir ).signature;
                    const nargs = Object.assign( {}, args.args, { mission: "exe", entry_point: 0 } );
                    const cn_data = this.run_mission_node( nargs, [ sgn_entry_point ] );
                    return cn_data.outputs[ 0 ];
                } );
                // append to the list
                cb_reduce( null, cns.concat( lst ) );
            } );
        }, ( err, cns ) => {
            if ( err ) return done( true );
            this.launch( args, done, cns );
        } );
    }

    /** maunch mocha. @argument cns: list of js (emitted) files to test */
    launch( args: MochaArgs, done: ( err: boolean ) => void, cns: Array<string> ) {
        // if nodejs is a target, call mocha directly
        let error = false, testing_env = [ ...args.target_testing_env ];
        const ind_nodejs = testing_env.findIndex( x => x.toLowerCase() == "nodejs" );
        if ( ind_nodejs >= 0 ) {
            let cmd_args = [ '-c', ...cns ];
            if ( this.av( args.mocha_reporter ) )
                cmd_args.unshift( '--reporter', this.av( args.mocha_reporter ) );
            if ( this.spawn( this.av( args.mocha ) || path.resolve( args.launch_dir, "node_modules", ".bin", "mocha" ), cmd_args, null, true, '', false ) )
                error = true;
            
            testing_env.splice( ind_nodejs, 1 );
        }

        // for the other targets, we (currently) use karma. TODO: support other tools
        if ( testing_env.length ) {
            // creation of a config file
            let content = "";
            content += `// Karma configuration\n`;
            content += `module.exports = function(config) {\n`;
            content += `  config.set({\n`;
            content += `    basePath: '${ args.launch_dir }',\n`;
            content += `    frameworks: ['mocha'],\n`;
            content += `    files: ${ JSON.stringify( cns ) },\n`;
            content += `    exclude: [ ],\n`;
            content += `    preprocessors: { },\n`;
            content += `    reporters: ['progress'],\n`;
            content += `    port: 9876,\n`;
            content += `    colors: ${ args.color },\n`;
            content += `    logLevel: config.LOG_INFO,\n`;
            content += `    autoWatch: false,\n`;
            content += `    browsers: ${ JSON.stringify( testing_env ) },\n`;
            content += `    singleRun: true,\n`;
            content += `    concurrency: Infinity\n`;
            content += `  })\n`;
            content += `}\n`;

            const karma_conf_name = this.new_build_file( cns.length ? path.basename( cns[ 0 ], path.extname( cns[ 0 ] ) ) : "", ".karma.conf.js" );
            this.write_file_sync( karma_conf_name, content );

            // check karma installation
            for ( const to_test of [ "karma", "karma-mocha", ...testing_env.map( x => `karma-${ x.toLowerCase() }-launcher` ) ] ) {
                try { this.stat( path.resolve( args.launch_dir, "node_modules", to_test ) ); }
                catch ( e ) { this.run_install_cmd( "", args.launch_dir, [ "npm", "install", to_test ], [] ); }
            }

            // launch
            if ( this.spawn( path.resolve( args.launch_dir, "node_modules", "karma", "bin", "karma" ), [ "start", karma_conf_name ], null, true )  )
                error = true;
        }

        // npm install karma-detect-browsers
        done( error );
    }
}
