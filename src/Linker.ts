import ExeDataGenCompiler from "./ExeDataGenCompiler"
import { SystemInfo }     from "./SystemInfo"
import { pu }             from "./ArrayUtil"
import { ExecutorArgs }   from "./Executor"
import Task               from "./Task"
import * as path          from 'path'

export
interface ArgsLinker {
    output   : Array<string>;
    mission  : string;
    cwd      : string;
    define   : Array<string>; /** NAME(args...)=val or NAME for macros without arguments */
    bootstrap: boolean;
    system   : SystemInfo;    /** ubuntu 14.04, ... */
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
            this.reg_err();
        this.o_makers[ n ] = res;

        // look if it implies additional stuff to parse, compile or link
        for( const moj of [ ...( res.exe_data.includes || [] ), ...( res.exe_data.obj_names || [] ) ] ) {
            const wo_ext = moj.slice( 0, moj.length - path.extname( moj ).length );
            const o_maker = this.get_first_filtered_target_signature( [ wo_ext + ".o_maker" ], path.dirname( moj ) );
            if ( o_maker && ! this.to_parse.has( o_maker.signature ) ) {
                const nn = this.to_parse.size;
                this.get_cn_data( o_maker.signature, ( err, cn_data ) => this.on_parsed( args, nn, err, cn_data as ResCnGenCompiler ) );
                this.to_parse.add( o_maker.signature );
            }
        }

        // launch the compilation
        this.get_cn_data( res.exe_data.command_sgn, ( err, cn_data ) => this.on_compiled( args, n, err, cn_data.outputs[ 0 ] ) );
    }

    /** called when source num `n` is compiled */
    on_compiled( args: ArgsLinker, n: number, err: boolean, o_name: string ) {
        // register
        this.o_names[ n ] = o_name;

        // if everything is compiled, launch `make_executable`
        for( let i = 0; ; ++i ) {
            if ( i == this.to_parse.size )
                return this.make_executable( args );
            if ( ! this.o_names[ i ] )
                break;
        }
    }

    reg_err() {
        if ( this.has_err )
            return;
        this.has_err = true;
        this.done_cb( true );
    }

    make_executable( args: ArgsLinker ) {
        this.new_build_file( this.o_makers[ 0 ].exe_data.orig_name || "", ".exe", "", ( err, name ) => {
            if ( err )
                return this.done_cb( true );
            this.make_executable_with_name( args, name );
        } );
    }

    make_executable_with_name( args: ArgsLinker, exe_name: string ) {
        this.set_status( "active" );
        this.outputs = [ exe_name ];
        
        // flags for output
        // const add_flags = lib_type == "dynamic" ? [ "-fpic" ] : [];
        let ext: string, cmd_args = [] as Array<string>, ld = "g++", lib_type = "exe";
        switch ( lib_type ) {
            case "static" : ext = '.a';   cmd_args.push( 'rc' ); ld = "ar"; break;
            case "dynamic": ext = '.so';  cmd_args.push( '-shared', '-o' ); break;
            default       : ext = '.exe'; cmd_args.push( '-o' );
        }
        cmd_args.push( exe_name );

        // objects
        cmd_args.push( ...this.o_names );

        // flags
        for( const cp of this.o_makers ) {
            pu( cmd_args, ...( cp.exe_data.lib_names || [] ).map( n => "-l" + n ) );
            pu( cmd_args, ...( cp.exe_data.lib_paths || [] ).map( n => "-L" + n ) );
        }

        // go (call the linker)
        this.spawn( ld, cmd_args, ( err, code ) => this.done_cb( Boolean( err || code ) ) );
    }

    has_err  = false;
    done_cb  : ( boolean ) => void;           /** `done` arg of `exec` func */
    to_parse = new Set<string>();             /** set of signatures of .o_maker nodes */
    o_makers = new Array<ResCnGenCompiler>(); /** signature => res of CppParser */ 
    o_names  = new Array<string>();           /** name of .o file */
}
