import CompilationEnvironment, { GcnItem } from "./CompilationEnvironment"
import { CoffeescriptCompilerArgs }        from "./CoffeescriptCompiler"
import { TypescriptCompilerArgs }          from "./TypescriptCompiler"
import FileDependencies                    from "./FileDependencies"
import CompilationNode                     from "./CompilationNode"
import ArgumentParser                      from "./ArgumentParser"
import { SassCompilerArgs }                from "./SassCompiler"
import { ArgsJsDepFactory }                from "./JsDepFactory"
import Generator                           from "./Generator"
import { pu }                              from "./ArrayUtil"
import { ExecutorArgs }                    from "./Executor"
import Service                             from "./Service"
import { MochaArgs }                       from "./Mocha"
import Pool                                from "./Pool"
import * as async                          from 'async'
import * as path                           from 'path'
import * as fs                             from 'fs'

export default
class GeneratorJs extends Generator {
    static js_ext    = [ ".js", ".jsx" ];
    static ts_ext    = [ ".ts", ".tsx" ];
    static cs_ext    = [ ".coffee", ".csx" ];
    static react_ext = [ ".jsx", ".tsx", ".csx" ];
    static sass_ext  = [ ".sass", ".scss" ];

    static js_family( ext : string ) { return GeneratorJs.js_like( ext ) || GeneratorJs.ts_like( ext ) || GeneratorJs.cs_like( ext ); }
    static js_like  ( ext : string ) { return GeneratorJs.js_ext.indexOf( ext.toLowerCase() ) >= 0; }
    static ts_like  ( ext : string ) { return GeneratorJs.ts_ext.indexOf( ext.toLowerCase() ) >= 0; }
    static cs_like  ( ext : string ) { return GeneratorJs.cs_ext.indexOf( ext.toLowerCase() ) >= 0; }

    static nodejs_base_modules = [
        "browser", "assert", "child_process", "cluster", "crypto", "dns", "domain", "events", "fs",
        "http", "https", "net", "os", "path", "punycode", "querystring", "readline", "repl", "stream",
        "string_decoder", "timers", "tls", "tty", "dgram", "url", "util", "v8", "vm", "zlib", "constants",
        "buffer"
    ];

    decl_additional_options( p: ArgumentParser ) {
        // generic arguments
        p.add_argument( [], [ 'js' ], 'nodejs', 'Set name of the nodejs executable (to run javascript)' );

        // missions
        p.set_mission_description( 'run'  , [ 'js' ], 'Compile and execute', [ "exe", "html" ]                                           );
        p.set_mission_description( 'exe'  , [ 'js' ], 'Make an executable'                                                               );
        p.set_mission_description( 'lib'  , [ 'js' ], 'Mmake a library'                                                                  );
        p.set_mission_description( 'html' , [ 'js' ], 'Make a html file (+ dependencies, like css, ...) from a js-like entry point'      );
        p.set_mission_description( 'mocha', [ 'js' ], 'Run tests using mocha (with transpilation, concatenation, ... managed by nsmake)' );

        const missions = [ 'run', 'exe', 'lib', 'html', 'mocha' ];
        p.add_argument( missions  , [ 'js' ], 'js-env'               , 'set javascript target environment (nodejs|browser)'                             , "string"  );
        p.add_argument( missions  , [ 'js' ], 'target-browsers'      , 'shortcut to set target browser(s) in babel-preset-env, list of strings separated ' +
                                                                     'by commas. Ex of value: "last 2 versions, safari >= 7"'                         , "string*" );
        p.add_argument( missions  , [ 'js' ], 'babel-env-arguments'  , 'set arguments for babel-preset-env in YAML format without the surrounding braces ' +
                                                                     '(@see https://github.com/babel/babel-preset-env). ' + 
                                                                     'Ex of value: "targets:{browsers:[\'last 2 versions\']}"'                        , "string"  );
        p.add_argument( missions  , [ 'js' ], 'sm-line'              , 'line added for sourcemap support if target is nodejs'                           , "string"  );
        p.add_argument( missions  , [ 'js' ], 'concat'               , 'make concatened versions (remove requires)'                                     , "boolean" );
        p.add_argument( missions  , [ 'js' ], 'min'                  , 'make minified versions'                                                         , "boolean" );
        p.add_argument( missions  , [ 'js' ], 'browser'              , 'specify browser(s) to launch html pages (use "," to specify different choices)' , "string*" );
        p.add_argument( [ "html" ], [ 'js' ], 'single-page'          , 'put everything in the resulting .html page'                                     , "boolean" );
        p.add_argument( [ "html" ], [ 'js' ], 'no-dist'              , 'do not save the output in a dist-like directory'                                , "boolean" );
        p.add_argument( missions  , [ 'js' ], 'hot-replacement'      , 'say that hot replacement is required'                                           , "boolean" );
        p.add_argument( missions  , [ 'js' ], 'hot-replacement-poll' , 'add a poll function in the main js file to check for change (delay in s)'       , "number" );
        p.add_argument( missions  , [ 'js' ], 'hot-replacement-type' , 'specify hot replacement type ("Hmr" by default, compatible with webpack)'       , "string"  );
        p.add_argument( missions  , [ 'js' ], 'o,output'             , 'set name(s) of the output file(s), separated by a comma if several are expected', 'path*'   );
        p.add_argument( missions  , [ 'js' ], 'js-header'            , 'header used for concatened javascript', 'cn'                                                );
        p.add_argument( missions  , [ 'js' ], 'D,define'             , 'add a define (like with the C preprocessor)'                                    , 'string*' );
        p.add_argument( missions  , [ 'js' ], 'ext-lib'              , 'Ex: "react https://unpkg.com/react@15/dist/react.js React" says that require `react` ' +
                                                                     'will be replaced by the variable `React` found in the data of the given url, '  , 'string*' );
        p.add_argument( missions  , [ 'js' ], 'no-implicit-any'      , 'prohibit implicit any(s) for typescript compiler'                               , 'boolean' );

        // html specifics
        p.add_positional_argument( [ 'html' ], 'entry_point', 'Entry point (a javascript file, or something that can be transpiled to javascript)', 'cn' );

        // mocha specifics
        p.add_positional_argument( [ 'mocha' ], 'entry_points'     , 'Entry points. Glob patterns are accepted', 'string*' );
        // p.add_argument( [ 'mocha' ], [ 'js' ], 'mocha'             , 'Set mocha executable (excepted for the "reporter" arg, option are passer via //// nsmake ... cmds).' );
        p.add_argument( [ 'mocha' ], [ 'js' ], 'mocha-reporter'    , 'Set the mocha reporter', 'string*' );
        p.add_argument( [ 'mocha' ], [ 'js' ], 'target-testing-env', 'where to launch the test, list of strings separated by commas. Can be NodeJS or any ' +
                                                                     'target supported by karma launcher (e.g. Chrome, Firefox, PhantomJS, ...)'      , "string*" );
    }

    get_gcn_funcs( funcs: Array<GcnItem> ) {
        funcs.push( { prio: 0, func: ( target: string, output: string, cwd: string, cb: ( cn: CompilationNode ) => void, for_found: FileDependencies, care_about_target: boolean ): void => {
            const t_ext = path.extname( target );
            if ( t_ext == ".js" ) {
                // make .js from .ts or .coffee or ...
                const basename = target.substr( 0, target.length - t_ext.length );
                return async.forEachSeries( [
                    ...GeneratorJs.ts_ext.map( ext => ({ ext, make_cn: ch => this.make_typescript_compiler  ( ch, care_about_target ? target : "" ) }) ),
                    ...GeneratorJs.cs_ext.map( ext => ({ ext, make_cn: ch => this.make_coffeescript_compiler( ch, care_about_target ? target : "" ) }) )
                ], ( trial, cb_ext ) => {
                    this.env.get_compilation_node( basename + trial.ext, cwd, for_found, cn => {
                        cb_ext( cn ? trial.make_cn( cn ) : null );
                    } );
                }, cb );
            } else if ( t_ext == ".css" ) {
                // make .css from .scss or .sass
                const basename = target.substr( 0, target.length - t_ext.length );
                return async.forEachSeries( [
                    ...GeneratorJs.sass_ext.map( ext => ({ ext, make_cn: ch => this.make_sass_compiler( ch, care_about_target ? target : "" ) }) ),
                ], ( trial, cb_ext ) => {
                    this.env.get_compilation_node( basename + trial.ext, cwd, for_found, cn => {
                        cb_ext( cn ? trial.make_cn( cn ) : null );
                    } );
                }, cb );
            }
            return cb( null );
        } } );
    }

    /** Here, CompilationNode arguments have an object { signature: string, name: string } as data */
    get_mission_node( for_found: FileDependencies, cb: ( cn: CompilationNode ) => void ): void {
        const args = this.env.args, cns = this.env.cns;

        // helper to get a string on argument that may refer (by a number) to a CompilationNode
        const ga = ( arg: string | number, default_value = "" ): string => typeof arg == "number" ? cns[ arg ].outputs[ 0 ] : ( arg || default_value );

        // run with mocha ?
        if ( args.mission == "mocha" ) {
            return cb( this.env.New( "Mocha", [], {
                target_testing_env: [].concat( ...this.env.arg_rec( "target_testing_env", [ "nodejs" ] ).map( x => x.split( "," ) ) ),
                entry_points      : args.entry_points || [],
                // mocha          : ga( this.env.arg_rec( "mocha" ) ),
                mocha_reporter    : ga( this.env.arg_rec( "mocha_reporter" ) ),
                args              : args, // hum...
                launch_dir        : this.env.cwd,
                color             : this.env.com.color,
            } as MochaArgs ) ); //  || path.resolve( this.env.cur_dir, "node_modules", ".bin", "mocha" )
        }

        //
        const with_a_dot_js = cn_js => {
            if ( ! cn_js )
                return cb( null );

            // run a js file ?
            if ( args.mission == "run" ) {
                // new mission, to make an "executable"
                let nce = this.env.clone( { mission: args.js_env == "browser" && ! args.run_loc ? "html" : "exe" } );
                return nce.get_mission_node( for_found, cn => {
                    if ( ! cn )
                        return cb( null );
                    cb( this.env.New( "Executor", [ ...cns, cn ], {
                        executable     : this.env.arg_rec( "nodejs" ) || "node",
                        args           : [ cns.length, ...( args.arguments || [] ) ],
                        local_execution: typeof args.local_execution == "undefined" ? true: args.local_execution,
                        outputs        : args.redirect ? [ args.redirect ] : [],
                        redirect       : args.redirect || '',
                        new_build_files: args.new_build_files || [],
                        idempotent     : args.idempotent || false,
                    } as ExecutorArgs ) );
                } );
            }

            // lib ?
            if ( [ "exe", "lib", "html", "min", "concat" ].indexOf( args.mission ) >= 0 ) {
                // DepFactory
                let ch = [ cn_js ], pos_js_header = -1;
                if ( js_env( args ) == "browser" ) {
                    pos_js_header = ch.length;
                    ch.push( args.js_header instanceof CompilationNode ? args.js_header : this.env.New( "Id", [], {
                        target: path.resolve( __dirname, `JsHeader${ hot_replacement( args ) }.js` )
                    } ) );
                }

                return cb( this.env.New( "JsDepFactory", ch, {
                    js_env              : js_env( args ),
                    output              : args.output || [],
                    mission             : args.mission,
                    single_page         : args.single_page || false,
                    no_dist             : args.no_dist || false,
                    sm_line             : sm_line( args ),
                    ext_libs            : args.ext_lib || [],
                    dist_dir            : this.env.arg_rec( "dist_dir" ) || path.resolve( this.env.cwd, "dist" ),
                    cwd                 : this.env.cwd,
                    concat              : concat             ( args ),
                    min                 : min                ( args ),
                    hot_replacement     : hot_replacement    ( args ),
                    hot_replacement_poll: args.hot_replacement_poll || null,
                    define              : define             ( args ),
                    babel_env_arguments : babel_env_arguments( args ),
                    target_browsers     : target_browsers    ( args ),
                    pos_js_header,
                } as ArgsJsDepFactory ) );
            }

            return cb( null );
        };

        // if we have a .js file, or if we can make it from this entry_point ?
        if ( args.entry_point != undefined ) {
            const en = cns[ args.entry_point ].outputs[ 0 ];
            if ( path.extname( en ) == ".js" || path.extname( en ) == ".jsx" )
                return with_a_dot_js( cns[ args.entry_point ] );

            const name_js = en.slice( 0, en.length - path.extname( en ).length ) + ".js";
            return this.env.get_compilation_node( name_js, path.dirname( en ), for_found, cn => {
                with_a_dot_js( cn && cn.some_rec( x => x.type == "Id" && x.args.target == en ) ? cn : null );
            } );
        }

        return cb( null );
    }

    make_typescript_compiler( ch: CompilationNode, output: string ): CompilationNode {
        return this.env.New( "TypescriptCompiler", [ ch ], {
            no_implicit_any: this.env.args.no_implicit_any || false,
            define         : this.env.args.define || [],
            js_env         : js_env( this.env.args ),
            launch_dir     : this.env.cwd,
            output,
        } as TypescriptCompilerArgs );
    }

    make_coffeescript_compiler( ch: CompilationNode, output: string ): CompilationNode {
        return this.env.New( "CoffeescriptCompiler", [ ch ], {
            define: this.env.args.define || [],
            output,
        } as CoffeescriptCompilerArgs );
    }

    make_sass_compiler( ch: CompilationNode, output: string ): CompilationNode {
        return this.env.New( "SassCompiler", [ ch ], {
            define: this.env.args.define || [],
            output,
        } as SassCompilerArgs );
    }

    /** */
    msg_from_service( service: Service, action: string, args: any, ans: ( err: boolean, res: any ) => void, err_msg: ( msg: string ) => void ) {
        switch ( action ) {
            case "register_ext_lib":
                if ( ! this.env.args.ext_lib )
                    this.env.args.ext_lib = [];
                const line = [ args.name, args.url, args.glob ].join( " " );
                pu( this.env.args.ext_lib, line );
                pu( service.cn.ext_libs, line );
                return;

            case "get_requires":
                return async.map( args.lst as Array<{cwd:string,requires:Array<string>}>, ( item: {cwd:string,requires:Array<string>}, cb: ( err: boolean, signatures: Array<string> ) => void ) => {
                    this._find_requires( service.env, service.cn, item.cwd, args.js_env, item.requires, args.typescript, cb );
                }, ans );

            default:
                err_msg( `There's no action ${ action } is GeneratorJs. => Service is going to be killed.` );
                service.cp.kill();
        }
    }

    launch_stuff_to_be_re_executed( cn: CompilationNode ) {
        for( const line of cn.ext_libs ) {
            if ( ! this.env.args.ext_lib )
                this.env.args.ext_lib = [];
            pu( this.env.args.ext_lib, line );
        }
    }

    _find_requires( env: CompilationEnvironment, cn: CompilationNode, cwd: string, js_env: string, requires: Array<string>, typescript: boolean, cb_find_require: ( err: boolean, signatures: Array<string> ) => void ) {
        const exts = typescript ? [ ".ts", ".tsx", ".d.ts" ] : [ ".js", ".jsx" ];

        async.map( requires, ( str: string, require_cb: ( err: boolean, sgn: string ) => void ) => {
            if ( ! str )
                return require_cb( null, "" );
            const ind_dtr = str.indexOf( '/' );
            const dtr = ind_dtr >= 0 && str[ 0 ] != '.' ? str.slice( 0, ind_dtr ) : str;

            // it is an ext_lib ?
            if ( typescript == false && js_env != "nodejs" ) {
                for( const ext_lib of this.env.args.ext_lib || [] ) {
                    const spl = ext_lib.split( " " );
                    if ( spl[ 0 ] == str ) {
                        return require_cb( false, Pool.signature( "MakeFile", [], {
                            content: `module.exports=${ spl[ 2 ] };`,
                            orig   : ext_lib,
                            ext    : ".js",
                        } ) );
                    }
                }
            }

            // helper to test for a module (`str`) from a given directory (`dir`)
            const test_from = ( dir: Array<string>, install_allowed: boolean ) => {
                let trials = new Array< { name: string, type: number } >();

                if ( exts.indexOf( path.extname( str ).toLowerCase() ) >= 0 ) {
                    trials.push({ name: path.resolve( dir[ 0 ], str ), type: 0 }); // foo.js
                } else {
                    for( let ext_trial of exts )
                        trials.push({ name: path.resolve( dir[ 0 ], str + ext_trial ), type: 0 }); // foo.js, foo.jsx...
                    if ( typescript == false || dir.length == 2 )
                        trials.push({ name: path.resolve( dir[ 0 ], str, "package.json" ), type: 1 }); // foo/package.json
                    for( let ext_trial of exts )
                        trials.push({ name: path.resolve( dir[ 0 ], str, "index" + ext_trial ), type: 0 }); // foo/index.js, foo/index.jsx...
                    if ( typescript && dtr != str ) {
                        if ( dir.length == 2 )
                            trials.push({ name: path.resolve( dir[ 0 ], dtr, "package.json" ), type: 1 }); // mod_name_of_foo/package.json
                        for( let ext_trial of exts )
                            trials.push({ name: path.resolve( dir[ 0 ], dtr, "index" + ext_trial ), type: 0 }); // mod_name_of_foo/index.ts...
                    }
                }

                // we want the signature of the first coming ncn 
                async.forEachSeries( trials, ( trial, cb_trial ) => {
                    env.get_compilation_node( trial.name, dir[ 0 ], cn.file_dependencies, ncn => {
                        cb_trial( ncn ? ( trial.type ? env.com.proc.pool.New( "MainJsFromPackageJson", [ ncn ], { js_env, typescript } ) : ncn ) : null );
                    } );
                }, ( ncn: CompilationNode ) => {
                    if ( ncn )
                        return require_cb( null, ncn.signature );
                    if ( dir.length > 1 )
                        return test_from( dir.slice( 1 ), install_allowed );
                    try_installation( install_allowed, dir[ 0 ] );
                } )
            };
            const try_installation = ( install_allowed: boolean, node_modules_dir: string ) => {
                // currently we only install module without relative paths
                if ( ! install_allowed )
                    return require_cb( null, '' );
                //
                if ( ( js_env == "nodejs" || typescript ) && GeneratorJs.nodejs_base_modules.indexOf( str ) >= 0 )
                    return require_cb( null, null );
                //
                if ( ! node_modules_dir ) {
                    // if file is in the launch directory, we add a node_module here
                    let dir = cwd.startsWith( env.cwd ) ? env.cwd : cwd;
                    const new_node_modules_dir = path.resolve( dir, "node_modules" );
                    return fs.mkdir( new_node_modules_dir, err => {
                        if ( err && err.code != 'EEXIST' ) {
                            env.com.error( cn, `Impossible to create directory ${ new_node_modules_dir }` );
                            return require_cb( null, '' );
                        }
                        try_installation( install_allowed, new_node_modules_dir );
                    } );
                    // env.com.error( cn, `Error while trying to load module '${ str }': there's no 'node_modules' directory from '${ cwd }' and the later is not in the launch dir ('${ env.cwd }'). Nsmake is not willing to create a 'node_modules' by itself... Please add a new one in '${ cwd }' or in a parent dir if you want nsmake to install the module (or... directly install the module, it would be another good solution :) )` );
                    // return require_cb( null, '' );
                }
                //
                const inds = str.indexOf( "/" ), base = inds >= 0 ? str.slice( 0, inds ) : str;
                env.com.proc.install_cmd( env.com, cn, path.dirname( node_modules_dir ), [ "npm", 'install', typescript ? `@types/` + base : base ], [], err => {
                    if ( err )
                        return env.com.error( cn, `Error: installation of '${ base }' failed.` ), require_cb( null, '' );
                    test_from( typescript ? [ path.resolve( node_modules_dir, "@types" ), node_modules_dir ] : [ node_modules_dir ], false ); 
                } );
            };

            // local, or look for a 'node_modules' directory, starting from cwd
            if ( ( str.length >= 2 && str.substr( 0, 2 ) == "./" ) || ( str.length >= 3 && str.substr( 0, 3 ) == "../" ) || ( str.length >= 1 && str[ 0 ] == '/' ) )
                test_from( [ cwd ], false );
            else
                GeneratorJs._find_node_modules_directory( cn, cwd, ( tn: string ) => tn ? test_from( typescript ? [ path.resolve( tn, "@types" ), tn ] : [ tn ], true ) : try_installation( true, "" ) );
        }, cb_find_require );
    }

    /** TODO: remove typescript arg, place err at the beginning */
    static _find_node_modules_directory( cn: CompilationNode, cwd: string, cb: ( tn: string, err: string ) => void, create_a_new_one = false, orig = cwd ) {
        let tn = path.resolve( cwd, "node_modules" );
        fs.stat( tn, ( err, stats ) => {
            // found ?
            if ( ! err && stats.isDirectory )
                return cb( tn, null );
            // register the failure
            if ( cn )
                cn.file_dependencies.failed.add( tn );
            // look if there's a parent
            const ncwd = path.dirname( cwd );
            // no parent => create in orig
            if ( ncwd == cwd ) {
                if ( ! create_a_new_one )
                    return cb( null, `Unable to find 'node_modules' dir from ${ orig }` );
                const dir = path.resolve( orig, "node_modules" );
                return fs.mkdir( dir, err => {
                    if ( err ) return cb( null, `Error: impossible to create directory '${ dir }'` );
                    cb( dir, null );
                } )
            }
            //
            GeneratorJs._find_node_modules_directory( cn, ncwd, cb, create_a_new_one, orig ); 
        } );
    }

    // browsers             = [ "google-chrome", "google-chrome-stable", "google-chrome-beta", "firefox", "opera" ];
}

function js_env             ( args ): string { return args.js_env || ( args.mission == "html" ? "browser" : "nodejs" ); }
function hot_replacement    ( args ): string { return args.hot_replacement ? ( args.hot_replacement_type || "Hmr" ) : ""; }
function sm_line            ( args ): string { return args.sm_line || "if ( typeof( process ) != 'undefined' && process.env.NODE_ENV != 'production' ) try { require('source-map-support').install(); } catch( e ) { console.error('Failed to load the \"source-map-support\" module'); }\n"; }
function babel_env_arguments( args ): string { return args.babel_env_arguments || ( js_env( args ) == "browser" ? 
            "targets:{browsers:['last 2 versions']}" : "{targets:{node:'current'}}" ); }
function concat             ( args ): boolean { return args.run_loc ? ( min( args ) || args.concat || false ) : false; }
function min                ( args ): boolean { return args.min ? ( args.min || false ) : false; }
function target_browsers    ( args ): Array<string> { return args.target_browsers || []; } 
function define             ( args ): Array<string> { return args.define || []; }

