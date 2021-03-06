import CompilationEnvironment, { GcnItem } from "./CompilationEnvironment"
import { ConcatYamlToJsonArgs }            from "./ConcatYamlToJson"
import FileDependencies                    from "./FileDependencies"
import CompilationNode                     from "./CompilationNode"
import ArgumentParser                      from "./ArgumentParser"
import { ArgsCppCompiler }                 from "./CppCompiler"
import Generator                           from "./Generator"
import { ExecutorArgs }                    from "./Executor"
import { ArgsLinker }                      from "./Linker"
import { GtestArgs }                       from "./Gtest"
import * as async                          from 'async'
import * as which                          from 'which'
import * as path                           from 'path'
import * as os                             from 'os'

export default
class GeneratorCpp extends Generator {
    static cpp_ext = [ ".cpp", ".cxx", ".cc" ];
    static cu_ext  = [ ".cu" ];
    static h_ext   = [ ".h", ".hxx" ];
    static c_ext   = [ ".c" ];

    static c_family( ext : string ) { return GeneratorCpp.c_like( ext ) || GeneratorCpp.cpp_like( ext ) || GeneratorCpp.cu_like( ext ); }
    static c_like  ( ext : string ) { return GeneratorCpp.c_ext  .indexOf( ext.toLowerCase() ) >= 0; }
    static cpp_like( ext : string ) { return GeneratorCpp.cpp_ext.indexOf( ext.toLowerCase() ) >= 0; }
    static cu_like ( ext : string ) { return GeneratorCpp.cu_ext .indexOf( ext.toLowerCase() ) >= 0; }
    static h_like  ( ext : string ) { return GeneratorCpp.h_ext  .indexOf( ext.toLowerCase() ) >= 0; }

    decl_additional_options( p : ArgumentParser ) {
        // generic arguments
        // p.add_argument( [], [ 'cpp' ], 'nodejs', 'Set name of the nodejs executable (to run javascript)' );

        // missions
        p.set_mission_description( 'run'  , [ 'cpp' ], 'compile and execute', [ "exe", "lib" ]                            );
        p.set_mission_description( 'exe'  , [ 'cpp' ], 'make an executable'                                               );
        p.set_mission_description( 'lib'  , [ 'cpp' ], 'make a library'                                                   );
        p.set_mission_description( 'gtest', [ 'cpp' ], 'launch tests using gtest (google test). It takes entry points, ' +
                'that can be glob patterns and launch all the tests found in these entries'                               );

        const comp_missions = [ 'lib', 'exe', 'run', 'gtest' ], universes = [ 'cpp', 'c', 'fortran', 'asm' ];
        p.add_argument( comp_missions, universes, "output,o"      , 'set name(s) of the output file(s), separated by a comma if several are expected' , 'path*'   );
        p.add_argument( comp_missions, universes, "exec-with"     , 'run executable using another executable (e.g. time -v)'                          , 'string'  );
        p.add_argument( comp_missions, universes, "include-path,I", "Add the directory arg to the list of directories to be searched for header files", 'path*'   );
        p.add_argument( comp_missions, universes, "library-path,L", "Add the directory arg to the list of directories to be searched for libraries"   , 'path*'   );
        p.add_argument( comp_missions, universes, "define,D"      , "Macro definition"                                                                , 'string*' );
        p.add_argument( comp_missions, universes, "debug-level,g" , "Set debug level"                                                                             );
        p.add_argument( comp_missions, universes, "opt-level,O"   , "Set optimization level"                                                                      );
        p.add_argument( comp_missions, universes, "cpp-flag"      , "Add flags for the C++ compiler"                                                  , 'string*' );
        p.add_argument( comp_missions, universes, "c-flag"        , "Add flags for the C compiler"                                                    , 'string*' );
        p.add_argument( comp_missions, universes, "ld-flag"       , "Add flags for the linker"                                                        , 'string*' );
        p.add_argument( comp_missions, universes, "cxx"           , "Set default C++ compiler"                                                                    );
        p.add_argument( comp_missions, universes, "cc"            , "Set default C compiler"                                                                      );
        p.add_argument( comp_missions, universes, "ld"            , "Set default linker"                                                                          );
        p.add_argument( comp_missions, universes, "ar"            , "Set default archiver"                                                                        );
        p.add_argument( comp_missions, universes, "dylib"         , "Make dynamic libraries"                                                          , 'boolean' );

        // p.add_positionnal_argument( [ 'exe', 'lib' ], 'entry_point', 'Entry point (sourcefile)', 'cn' );
        p.add_positional_argument( [ 'gtest' ], 'entry_points', 'Entry points. Glob patterns are accepted', 'string*' );
    }

    get_gcn_funcs( funcs: Array<GcnItem> ) {
        funcs.push( { prio: 0, func: ( target: string, output: string, cwd: string, cb: ( cn: CompilationNode ) => void, for_found: FileDependencies, care_about_target: boolean, allow_generation: boolean ): void => {
            // make .o from .cpp or .c or ...
            const t_ext = path.extname( target );
            if ( t_ext == ".o_maker" ) {
                const basename = target.substr( 0, target.length - t_ext.length );
                return async.forEachSeries( [
                    ...GeneratorCpp.cpp_ext.map( ext => ({ ext, make_cn: ( ch, cb ) => this.make_cpp_compiler( ch, care_about_target ? target : "", cb ) }) ),
                    ...GeneratorCpp.cu_ext .map( ext => ({ ext, make_cn: ( ch, cb ) => this.make_cpp_compiler( ch, care_about_target ? target : "", cb ) }) ),
                    ...GeneratorCpp.c_ext  .map( ext => ({ ext, make_cn: ( ch, cb ) => this.make_cpp_compiler( ch, care_about_target ? target : "", cb ) }) ),
                ], ( trial, cb_ext ) => {
                    this.env.get_compilation_node( basename + trial.ext, cwd, for_found, cn => {
                        cn ? trial.make_cn( cn, cb_ext ) : cb_ext( null );
                    }, false, allow_generation );
                }, cb );
            }
            return cb( null );
        } } );
    }

    /** Here, CompilationNode arguments have an object { signature: string, name: string } as data */
    get_mission_node( for_found: FileDependencies, cb: ( cn: CompilationNode ) => void ): void {
        // shortcuts
        const args = this.env.args, cns = this.env.cns;

        // run with mocha ?
        if ( args.mission == "gtest" ) {
            return cb( this.env.New( "Gtest", [], {
                entry_points      : args.entry_points || [],
                args              : args, // hum...
                launch_dir        : this.env.cwd,
                color             : this.env.com.color,
            } as GtestArgs ) ); //  || path.resolve( this.env.cur_dir, "node_modules", ".bin", "mocha" )
        }

        // if we have a .o or something that generates a .o, we can make a lib, an executable, run it, ...
        const with_a_dot_o = cn_o => {
            if ( ! cn_o )
                return cb( null );

            // run
            if ( args.mission == "run" ) {
                // => call 'exe' mission and add an run above that
                let nce = this.env.clone( { mission: "exe" } );
                return nce.get_mission_node( for_found, cn => {
                    if ( ! cn )
                        return cb( null );
                    // launch
                    return cb( this.env.New( "Executor", [ ...cns, cn ], {
                        executable     : cns.length,
                        args           : args.arguments || [],
                        local_execution: typeof args.local_execution == "undefined" ? true: args.local_execution,
                        use_lib_paths  : true,
                        outputs        : args.redirect ? [ args.redirect ] : [],
                        redirect       : args.redirect || '',
                        new_build_files: args.new_build_files || [],
                        idempotent     : args.idempotent || false,
                        exec_with      : args.exec_with || '',
                        orig_env       : this.env.com.env_vars,
                    } as ExecutorArgs ) );
                } );
            }

            // executable or library ?
            if ( [ "exe", "lib" ].indexOf( args.mission ) >= 0 ) {
                return cb( this.env.New( "Linker", [ cn_o, this.cpp_rules_cn(), this.base_compiler_info_cn( this.env.arg_rec( "cxx" ), "cpp" ) ], {
                    output     : args.output || [],
                    mission    : args.mission,
                    cwd        : this.env.cwd,
                    define     : define( args ),
                    dylib      : dylib( args ),
                    bootstrap  : args.cpp_bootstrap || false,
                    system     : this.env.com.proc.system_info,
                    cmd_flags  : split_spurienc( this.env.args.ld_flag || [] ),
                    ld_in_args : this.env.args.ld,
                    ar_in_args : this.env.args.ar,
                    debug_level: this.env.args.debug_level || null,
                    opt_level  : this.env.args.opt_level || null,
                } as ArgsLinker ) );
            }

            // 
            return cb( null );
        };

        // we have a .o file, or we can make it from this entry_point ?
        if ( args.entry_point != undefined ) {
            const en = cns[ args.entry_point ].outputs[ 0 ];
            if ( path.extname( en ) == ".o_maker" )
                return with_a_dot_o( cns[ args.entry_point ] );

            const name_o = en.slice( 0, en.length - path.extname( en ).length ) + ".o_maker";
            return this.env.get_compilation_node( name_o, path.dirname( en ), for_found, cn => {
                with_a_dot_o( cn && cn.some_rec( x => x.type == "Id" && x.args.target == en ) ? cn : null );
            }, false, false );
        }

        return cb( null );
    }

    make_cpp_compiler( cn: CompilationNode, output: string, cb: ( cn: CompilationNode ) => void, for_c = false ): void {
        const ncc = `CppCompiler@${ path.resolve( __dirname, "cpp", "main_cpp_services.cpp" ) }`;
        cb( this.env.New( this.env.args.cpp_bootstrap ? "CppCompiler": ncc, [ cn, this.cpp_rules_cn(), this.base_compiler_info_cn( this.env.arg_rec( "cxx" ), "cpp" ) ], {
            define     : this.env.args.define || [],
            debug_level: this.env.args.debug_level || null,
            opt_level  : this.env.args.opt_level || null,
            system     : this.env.com.proc.system_info,
            launch_dir : this.env.cwd,
            inc_paths  : include_path( this.env.args ),
            cmd_flags  : split_spurienc( ( for_c ? this.env.args.c_flag :  this.env.args.cpp_flag ) || [] ),
            pic        : pic( this.env.args ),
            output,
        } as ArgsCppCompiler ) );
    }

    /** concatenation of rules for c/cpp/... */
    cpp_rules_cn(): CompilationNode {
        return this.env.New( "ConcatYamlToJson", [], {
            directories: [
                path.resolve( this.env.cwd, "nsmake", "rules", "cpp" ),
                path.resolve( __dirname, "..", "rules", "cpp" ),
                path.resolve( this.env.com.proc.nsmake_dir, "rules", "cpp" ),
            ]
        } as ConcatYamlToJsonArgs );
    }

    /** get stuff like base include paths, defines, ...  `target` can be cpp, c, ... */
    base_compiler_info_cn( compiler: string, target: string ): CompilationNode {
        return this.env.New( "BaseCompilerInfo", [], {
            compiler,
            target,
        } );
    }
}

function define      ( args ): Array<string> { return args.define       || [];    }
function dylib       ( args ): boolean       { return args.dylib        || false; }
function pic         ( args ): boolean       { return args.mission == "lib" && ( args.dylib || ( args.output && args.output.length && [ ".so", ".dll", ".dylib" ].indexOf( path.extname( args.output[ 0 ] ).toLowerCase() ) >= 0 ) ); }
function include_path( args ): Array<string> { return args.include_path || [];    }

function split_spurienc( lst: Array<string> ): Array<string> {
    let res = new Array<string>();
    for( const inp of lst )
        for( const str of inp.split( " " ) )
            if ( str.length )
                res.push( decodeURIComponent( str ) );
    return res;
}
