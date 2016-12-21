import ExeDataGenCompiler from "./ExeDataGenCompiler"
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
    system   : string         /** ubuntu 14.04, ... */
}

interface ResCnGenCompiler {
    signature     : string;                /** signature of CppParser(...) */
    outputs       : Array<string>;
    exe_data      : ExeDataGenCompiler;
    // added by Linker
    orig_signature: string;                /** signature of the parsed file */
    // parents       : Array<ResCppParser>;
    // need_rewrite  : boolean;
    // content       : string;             /** content used in CppParser */
    // sourcemap     : SourceMap;          /** */
    // mtime         : number;             /** modification date of the used output */
}

/** child 0 => entry object file
 */
export default
class Linker extends Task {
    exec( args: ArgsLinker ) {
        //
        this.objects.push( this.children[ 0 ] as ResCnGenCompiler );
        for( let num_obj_to_read = 0; num_obj_to_read < this.objects.length; ) {
            // read data from object node (result of src parsing)
            let new_obj_sgns = new Array<string>();
            for( ; num_obj_to_read < this.objects.length; ++num_obj_to_read ) {
                const res = this.objects[ num_obj_to_read ];

                // we have something to be compiled along the header file ?
                for( const moj of [ ...( res.exe_data.includes || [] ), ...( res.exe_data.obj_names || [] ) ] ) {
                    const wo_ext = moj.slice( 0, moj.length - path.extname( moj ).length );
                    const object = this.get_first_filtered_target_signature( [ wo_ext + ".o" ], path.dirname( moj ) );
                    if ( object && this.objects.every( x => x.signature != object.signature ) && new_obj_sgns.every( x => x != object.signature ) )
                        new_obj_sgns.push( object.signature );
                }
            }

            // append content in objects
            if ( new_obj_sgns.length )
                this.objects.push( ...this.get_cns_data( new_obj_sgns ) as ResCnGenCompiler[] );
        }

        this.make_executable( args );
    }

    make_executable( args: ArgsLinker ) {
        // output name
        const exe_name = this.new_build_file( this.objects[ 0 ].exe_data.orig_name || "", ".exe" );
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
        for( const object of this.objects )
            cmd_args.push( object.outputs[ 0 ] );

        // flags
        for( const cp of this.objects ) {
            pu( cmd_args, ...( cp.exe_data.lib_names || [] ).map( n => "-l" + n ) );
            pu( cmd_args, ...( cp.exe_data.lib_paths || [] ).map( n => "-L" + n ) );
        }

        // go
        this.spawn_sync( ld, cmd_args );
    }

    objects = new Array<ResCnGenCompiler>();   /** signature => res of CppParser */ 
}
