import FileDependencies from "./FileDependencies"
import * as rimraf      from "rimraf"
import * as async       from "async"
import * as fs          from "fs"

export interface Degraded {
    cn  : CompilationNode;
    mul?: number;
    off?: number;
}


export default
class CompilationNode {
    constructor( signature: string, type: string, children: Array<CompilationNode>, args: any, degraded = null as Degraded ) {
        this.signature = signature;
        this.type      = type;
        this.children  = children;
        this.args      = JSON.parse( JSON.stringify( args ) );
        this.degraded  = degraded;
    }

    get pretty(): string {
        return `${ this.type }(${ [ ...this.children.map( ch => ch.pretty ), JSON.stringify( this.args ) ].join( ',' ) })`
    }

    /** return this if this or one of its child rec checks the `cond` */
    some_rec( cond: ( cn: CompilationNode ) => boolean, visited = null as Set<CompilationNode>, line = null as Array<CompilationNode>, in_children_only = false, _line = [ this ] ): boolean {
        if ( in_children_only ) 
            return this.children           .some( ch => ch.some_rec( cond, visited, line, false, _line ) ) ||
                   this.additional_children.some( ch => ch.some_rec( cond, visited, line, false, _line ) );

        if ( visited ) {
            if ( visited.has( this ) )
                return false;
            visited.add( this );
        }

        if ( cond( this ) ) {
            if ( line )
                line.push( ..._line, this );
            return true;
        }
        return this.children           .some( ch => ch.some_rec( cond, visited, line, false, line ? [ ..._line, this ] : _line ) ) ||
               this.additional_children.some( ch => ch.some_rec( cond, visited, line, false, line ? [ ..._line, this ] : _line ) );
    }

    merge_res_from( ch: CompilationNode ): void {
        this.idempotent = this.idempotent && ch.idempotent;
        this.file_dependencies.merge( ch.file_dependencies );
        for( const puga of ch.push_unique_in_global_arg )
            if ( ! this.push_unique_in_global_arg.find( x => x.arg == puga.arg && x.val == puga.val ) )
                this.push_unique_in_global_arg.push( puga );
    }

    _init_for_build( init_cb: ( err: string ) => void ) {
        // cleansing of generated output files
        async.forEachOf( this.generated, ( name, index, cb ) => {
            fs.stat( name, ( err, stats ) => {
                if ( err )
                    return cb( null );
                if ( stats.mtime.getTime() != this.generated_mtimes[ index ] )
                    return cb( `Error: file ${ name } has been modified independently of nsmake. Nsmake is not going to remove/overwrite it. If you want to continue, please remove it manually (cur=${ stats.mtime.getTime() }, reg=${ this.generated_mtimes[ index ]}).` );
                rimraf( name, cb );
            } );
        }, err => {
            if ( err ) return init_cb( err.toString() );
            
            this.additional_children.length       = 0;
            // this.outputs.length                   = 0;
            // this.output_mtimes.length             = 0;
            this.generated.length                 = 0;
            this.generated_mtimes.length          = 0;
            this.push_unique_in_global_arg.length = 0;
            // this.exe_data                         = {};
            this.idempotent                       = true;
            this.substitution                     = null;
            this.num_build_exec                   = this.num_build_seen;
            this.file_dependencies.clear();

            init_cb( null );
        } );
    }

    start_chrono() {
        this.start = process.hrtime() as [ number, number ];
        this.cum_time = 0.0;
    }

    pause_chrono() {
        let t = process.hrtime( this.start );
        this.cum_time += t[ 0 ] + t[ 1 ] / 1e9;
    }

    resume_chrono() {
        this.start = process.hrtime() as [ number, number ];
    }
    
    // stable arguments    
    signature                  : string;                                /** serve as an unique id */
    type                       : string;                                /** e.g. CppCompiler, MissionNode, ... */
    children                   : Array<CompilationNode>;                /** base children (not the ones added during compilation) */
    args                       : any;                                   /** arguments */
    degraded                   : Degraded;                              /** */
                
    // for Processor 
    num_build_done             = 0;                                     /** */
    num_build_seen             = 0;                                     /** */
    num_build_exec             = 0;                                     /** */
    build_error                = false;                                 /** true is previous build led to an error */        
    loaded_from_db             = false;                                 /** true if already loaded from the database */
    done_cbs                   = new Array<( err: boolean ) => void>(); /** waiting done_cb */
    start                      : [ number, number ];                    /** time */
    substitution               = null as CompilationNode;               /** */
 
    // output saved to the db, re-used between builds     
    outputs                    = new Array<string>();                   /** output files (generated or not) */
    output_mtimes              = new Array<number>();                   /** modification time of outputs when done */
    exe_data                   = {} as any;                             /** output data structure */
    generated                  = new Array<string>();                   /** generated files (must be deleted if redo or clean, ...) */
    generated_mtimes           = new Array<number>();                   /** modification time of outputs when done */
    file_dependencies          = new FileDependencies;
    push_unique_in_global_arg  = new Array<{ arg: string, val: string }>();
    cum_time                   = 0.0;                                   /** time spent for execution of this (excluding time spent for the children) */

    // for time estimation
    static cur_time_est_id     = 0;
    time_est_id                = 0;
    time_est_to_redo           = false;
    time_est_start_time        = 0;
    time_est_completion_time   = 0;
    time_est_nb_ch_to_complete = 0;
    time_est_parents           = new Array<CompilationNode>();

    // intermediate outputs
    additional_children        = new Array<CompilationNode>();          /** children added during execution */
    idempotent                 = true;                                  /** true is different execution with the same parameters yield the same results */
} 
 
