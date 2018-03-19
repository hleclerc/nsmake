import ExeDataGenCompiler from "./ExeDataGenCompiler"
import { SystemInfo }     from "./SystemInfo"
import { pu }             from "./ArrayUtil"
import { ExecutorArgs }   from "./Executor"
import Task               from "./Task"
import * as path          from 'path'

export
interface ArgsLinker {
    output     : Array<string>;
    mission    : string;
    cwd        : string;
    define     : Array<string>; /** NAME(args...)=val or NAME for macros without arguments */
    cmd_flags  : Array<string>; /**  */
    bootstrap  : boolean;
    system     : SystemInfo;    /** e.g. ubuntu 14.04, ... */
    dylib      : boolean;       /**  */
    ld_in_args : string;        /** ld specified in cmd line arguments */
    ar_in_args : string;        /** ld specified in cmd line arguments */
    debug_level: string;
    opt_level  : string;
}

interface ResCnGenCompiler {
    signature     : string;                /** signature of CppParser(...) */
    outputs       : Array<string>;
    exe_data      : ExeDataGenCompiler;
    // added by Linker
    orig_signature: string;                /** signature of the parsed file */
}

/** child 0 => entry object file
 */
export default
class Linker extends Task {
    exec( args: ArgsLinker, done: ( boolean ) => void ) {
        // this task essentially call stuff and wait for stuff to be finished...
        this.set_status( "waiting" );

        this.done_cb = done;
        this.to_parse.add( this.children[ 0 ].signature );
        this.on_parsed( args, 0, false, this.children[ 0 ] as ResCnGenCompiler );
    }

    /** called when source num `n` is parsed */
    on_parsed( args: ArgsLinker, n: number, err: boolean, res: ResCnGenCompiler ) {
        if ( err )
            return this.reg_err();

        // check that orig file does not appear twice
        for( const om of this.o_makers ) {
            if ( om && om.exe_data.orig_name == res.exe_data.orig_name ) {
                this.error( `Object from '${ res.exe_data.orig_name }' is added twice to the linker. It may be due to a '/// nsmake global' flag added to one version and not to the second.` );
                return this.reg_err();
            }
        }
        this.o_makers[ n ] = res;

        // update no comps
        for( const inc of res.exe_data.no_comps || [] )
            this.no_comps.add( inc );

        // look if it implies additional stuff to parse, compile or link. TODO: async version
        for( const moj of [ ...( res.exe_data.includes || [] ), ...( res.exe_data.obj_names || [] ) ] ) {
            if ( this.no_comps.has( moj ) )
                continue;

            ++this.nb_test_if_obj;
            const wo_ext = moj.slice( 0, moj.length - path.extname( moj ).length );
            const o_maker = this.get_first_filtered_target_signature( [ wo_ext + ".o_maker" ], path.dirname( moj ), ( err, o_maker ) => {
                --this.nb_test_if_obj;
                // look if we have an associated .cc/.ccp/... file
                if ( o_maker && ! this.to_parse.has( o_maker.signature ) ) {
                    const nn = this.to_parse.size;
                    this.to_parse.add( o_maker.signature );
                    this.get_cn_data( o_maker.signature, ( err, cn_data ) => this.on_parsed( args, nn, err, cn_data as ResCnGenCompiler ) );
                } else
                    this.try_make_executable( args );
            }, false );
        }

        // launch the compilation
        this.get_cn_data( res.exe_data.command_sgn, ( err, cn_data ) => this.on_compiled( args, n, err, cn_data && ! err ? cn_data.outputs[ 0 ] : null ) );
    }

    /** called when source num `n` is compiled */
    on_compiled( args: ArgsLinker, n: number, err: boolean, o_name: string ) {
        if ( err || ! o_name )
            return this.reg_err();
        this.o_names[ n ] = o_name;
        this.try_make_executable( args );
    }

    reg_err() {
        if ( this.has_err )
            return;
        this.has_err = true;
        this.done_cb( true );
    }

    extension( args: ArgsLinker ): string {
        if ( args.mission == "lib" ) {
            if ( args.dylib ) {
                switch ( args.system.os ) {
                    case "win32" : return ".dll";
                    case "darwin": return ".dylib";
                    default      : return ".so";
                }
            }
            return ".a";
        }
        return ".exe";
    }

    try_make_executable( args: ArgsLinker ) {
        // if we tested all the possible .o_maker
        if ( this.nb_test_if_obj )
            return;

        // if everything is compiled, launch `make_executable`
        for( let i = 0; ; ++i ) {
            if ( i == this.to_parse.size )
                return this.make_executable( args );
            if ( ! this.o_names[ i ] )
                break;
        }
    }

    make_executable( args: ArgsLinker ) {
        this.new_build_file( this.o_makers[ 0 ].exe_data.orig_name || "", this.extension( args ), "", ( err, name ) => {
            if ( err )
                return this.done_cb( true );
            this.make_executable_with_name( args, name );
        }, args.output.length ? args.output[ 0 ] : null );
    }

    make_executable_with_name( args: ArgsLinker, exe_name: string ) {
        this.set_status( "active" );
        this.outputs = [ exe_name ];

        // if not specified, we link using the compiler... it's not formely a linker but it does a good job at setting the flags.
        // to be changed for languages for which it does not work
        let ld = args.ld_in_args || this.o_makers[ 0 ].exe_data.compiler;
        
        // flags for output
        let cmd_args = [] as Array<string>;
        if ( args.mission == "lib" ) {
            if ( args.dylib || ( args.output.length && [ ".so", ".dll", ".dylib" ].indexOf( path.extname( args.output[ 0 ] ).toLowerCase() ) >= 0 ) ) {
                cmd_args.push( '-shared', '-o', exe_name );
            } else {
                ld = args.ar_in_args || this.o_makers[ 0 ].exe_data.archiver;
                cmd_args.push( 'rc', exe_name );
            }
        } else {
            cmd_args.push( '-o', exe_name );
        }

        // objects
        cmd_args.push( ...this.o_names );

        // flags
        if ( args.cmd_flags )
            pu( cmd_args, ...args.cmd_flags );
        for( const cp of this.o_makers ) {
            pu( cmd_args, ...( cp.exe_data.lib_names || [] ).map( n => "-l" + n ) );
            pu( cmd_args, ...( cp.exe_data.lib_paths || [] ).map( n => "-L" + n ) );
            pu( cmd_args, ...( cp.exe_data.lib_flags || [] ) );
        }
        if ( args.debug_level )
            pu( cmd_args, "-g" + args.debug_level );
        if ( args.opt_level )
            pu( cmd_args, "-O" + args.opt_level );

        // data to be transmitted to parents
        this.exe_data.lib_paths = [];
        this.exe_data.exe_paths = [];
        for( const cp of this.o_makers ) {
            if ( cp.exe_data.lib_paths ) 
                pu( this.exe_data.lib_paths, ...cp.exe_data.lib_paths );
            if ( cp.exe_data.exe_paths ) 
                pu( this.exe_data.exe_paths, ...cp.exe_data.exe_paths );
        }

        // go (call the linker directly in the task: that's the only remaining thing to do)
        this.spawn( ld, cmd_args, ( err, code ) => this.done_cb( Boolean( err || code ) ) );
    }

    has_err        = false;
    done_cb        : ( boolean ) => void;           /** `done` arg of `exec` func */
    to_parse       = new Set<string>();             /** set of signatures of .o_maker nodes */
    no_comps       = new Set<string>();             /**  */
    o_makers       = new Array<ResCnGenCompiler>(); /** signature => res of CppParser */ 
    o_names        = new Array<string>();           /** name of .o file */
    nb_test_if_obj = 0;
}
