import { ResJsDepFactory } from "./JsDepFactory"
import Task                from "./Task"
import * as lodash         from "lodash"
import * as Moc            from "mocha"
import * as async          from "async"
import * as path           from "path"
import * as glob           from "glob"
import * as fs             from "fs"

/** positive of null number -> reference to children. negative number => - reference to new_build_files - 1 */
export interface MochaArgs {
    target_testing_env: Array<string>;
    entry_points      : Array<string>;
    args              : any;
    mocha_reporter    : string | number;
    launch_dir        : string,
    color             : boolean,
}

export default
class Mocha extends Task {
    exec( args: MochaArgs, done: ( err: boolean ) => void ) {
        // we want to redo the call each time we relaunch the mission
        this.idempotent = false;

        // nodejs and/or browser ?
        let needed_modules = [ [ "mocha" ], [ "@types", "mocha" ] ], js_envs = [];
        let testing_envs = lodash.uniq( args.target_testing_env );
        const ind_nodejs = testing_envs.findIndex( x => x.toLowerCase() == "nodejs" );
        if ( ind_nodejs >= 0 ) {
            testing_envs.splice( ind_nodejs, 1 );
            js_envs.push( "nodejs" );
        }
        if ( testing_envs.length ) {
            needed_modules.push( [ "karma" ], [ "karma-mocha" ], [ "karma-mocha-reporter" ], ...testing_envs.map( x => [ `karma-${ x.toLowerCase() }-launcher` ] ) );
            js_envs.push( "browser" );
        }

        // check installation
        this.check_js_mod_installation( args, needed_modules, err => {
            if ( err ) return done( true );

            // get, register and make the input compilation nodes
            async.reduce( args.entry_points, new Array<string>(), ( entry_points, entry_point, cb_reduce ) => {
                glob( entry_point, { cwd: args.launch_dir }, ( err, matches ) => {
                    if ( err ) { this.error( err.toString() ); return cb_reduce( new Error, null ); }
                    cb_reduce( null, entry_points.concat( matches ) );
                } );
            }, ( err, entry_points ) => {
                if ( err ) return done( true );
                // launch for each js_env
                async.forEachSeries( js_envs, ( js_env, cb ) => {
                    this.launch( args, cb, js_env, entry_points, testing_envs );
                }, done );
            } );
        } );

    }

    /** look for a  node_modules directory and check if modules in needed_modules are present. Install them if not the case */
    check_js_mod_installation( args: MochaArgs, needed_modules: Array<Array<string>>, cb_check: ( err: boolean ) => void ) {
        this.find_directory_from( args.launch_dir, "node_modules", ( err, tn ) => {
            if ( err )
                return cb_check( true );
            this.node_modules = tn;

            async.map( needed_modules, ( dir, cb_map ) => {
                this.is_directory( path.resolve( tn, ...dir ), ( ans ) => cb_map( null, ans ? null : dir.join( '/' ) ) );
            }, ( err, _missing: Array<string> ) => {
                const missing = _missing.filter( x => x != null );
                if ( missing.length == 0 ) 
                    return cb_check( false );
                this.run_install_cmd( args.launch_dir, [ "npm", "install", ...missing ], [], ( err, fail ) => {
                    cb_check( err || fail );
                } );
            } );
        }, true );
    }

    /** maunch mocha. @argument entry_points: list of js-like files to test */
    launch( args: MochaArgs, done: ( err: boolean ) => void, js_env: string, entry_points: Array<string>, testing_envs: Array<string> ) {
        // make an "executable" for each item in the entry point
        async.map( entry_points, ( entry_point: string, cb_map: ( err: boolean, output: Array<string> ) => void ) => {
            // TODO: use a correct js_env for get_filtered_target_signature. Prop: using an additionnal arg to get a new comp env
            this.get_filtered_target_signature( path.resolve( args.launch_dir, entry_point ), args.launch_dir, ( err, ep_signature ) => {
                const nargs = Object.assign( {}, args.args, {
                    mission    : "exe", // js_env == "nodejs" ? "exe" : "html",
                    entry_point: 0,
                    js_env
                } );
                this.run_mission_node( nargs, [ ep_signature ], ( err, cn_data ) => {
                    cb_map( err, err ? null : [ ...( ( cn_data.exe_data as ResJsDepFactory ).url_ext_libs || [] ), cn_data.outputs[ 0 ] ] );
                } );
            } );

        }, ( err: boolean, output_arrays: Array<Array<string>> ) => {
            if ( err ) return done( true );
            const outputs = lodash.uniq( output_arrays.reduce( ( p, c ) => p.concat( c ), [] ) );

            // if nodejs is a target, call mocha directly
            if ( js_env == "nodejs" ) {
                let cmd_args = [ '-c', ...outputs ];
                if ( this.av( args.mocha_reporter ) )
                    cmd_args.unshift( '--reporter', this.av( args.mocha_reporter ) );
                return this.spawn( path.resolve( this.node_modules, ".bin", "mocha" ), cmd_args, ( err, code ) => {
                    done( Boolean( err || code ) );
                }, true /* local execution*/ );
            }

            // else, use karma (TODO: allow other exection environnments)
            // creation of a config file
            let content = "";
            content += `// Karma configuration\n`;
            content += `module.exports = function(config) {\n`;
            content += `  config.set({\n`;
            content += `    basePath: '${ args.launch_dir }',\n`;
            content += `    frameworks: ['mocha'],\n`;
            content += `    files: ${ JSON.stringify( [ ...outputs, { pattern: '**', included: false, served: true } ] ) },\n`;
            content += `    exclude: [ ],\n`;
            content += `    preprocessors: { },\n`;
            content += `    reporters: ['mocha'],\n`;
            content += `    port: 9876,\n`;
            content += `    colors: ${ args.color },\n`;
            content += `    logLevel: config.LOG_INFO,\n`;
            content += `    autoWatch: false,\n`;
            content += `    browsers: ${ JSON.stringify( testing_envs ) },\n`;
            content += `    singleRun: true,\n`;
            content += `    concurrency: Infinity\n`;
            content += `  })\n`;
            content += `}\n`;

            this.new_build_file( outputs.length ? path.basename( outputs[ 0 ], path.extname( outputs[ 0 ] ) ) : "", ".karma.conf.js", null, ( err, karma_conf_name ) => {
                if ( err ) return done( true );
                this.write_file( karma_conf_name, content, err => {
                    if ( err ) return this.error( err.toString() ), done( true );
                    // launch
                    this.spawn( path.resolve( this.node_modules, "karma", "bin", "karma" ), [ "start", karma_conf_name ], ( err, code ) => {
                        done( Boolean( err || code ) );
                    }, true );
                } );
            } );

        } );
    }

    node_modules = "";
}
