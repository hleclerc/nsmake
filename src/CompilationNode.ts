import FileDependencies from "./FileDependencies"
import * as rimraf      from "rimraf"
import * as async       from "async"
import * as fs          from "fs"

export default
class CompilationNode {
    constructor( signature: string, type: string, children: Array<CompilationNode>, args: any ) {
        this.signature = signature;
        this.type      = type;
        this.children  = children;
        this.args      = JSON.parse( JSON.stringify( args ) );
    }

    get pretty(): string {
        return `${ this.type }(${ [ ...this.children.map( ch => ch.pretty ), JSON.stringify( this.args ) ].join( ',' ) })`
    }

    /** return this if this or one of its child rec checks the `cond` */
    some_rec( cond: ( cn: CompilationNode ) => boolean ): boolean {
        return cond( this ) || this.children.some( ch => ch.some_rec( cond ) );
    }

    _init_for_build( init_cb: ( err: string ) => void ) {
        // cleansing of generated output files
        async.forEachOf( this.generated, ( name, index, cb ) => {
            fs.stat( name, ( err, stats ) => {
                if ( err )
                    return cb( null );
                if ( stats.mtime.getTime() != this.generated_mtimes[ index ] )
                    return cb( `Error: file ${ name } has been modified independently of nsmake. Nsmake is not going to remove/overwrite it. If you want to continue, please remove it manually.` );
                rimraf( name, cb );
            } );
        }, err => {
            if ( err ) return init_cb( err.toString() );
            
            this.additional_children.length = 0;
            this.outputs.length             = 0;
            this.output_mtimes.length       = 0;
            this.generated.length           = 0;
            this.generated_mtimes.length    = 0;
            this.exe_data                   = {};
            this.pure_function              = true;
            this.num_build_exec             = this.num_build_seen;
            this.start                      = process.hrtime() as [ number, number ];
            this.file_dependencies.clear();

            init_cb( null );
        } );

    }

    // stable arguments    
    signature           : string;                                /** serve as an unique id */
    type                : string;                                /** e.g. CppCompiler, MissionNode, ... */
    children            : Array<CompilationNode>;                /** base children (not the ones added during compilation) */
    args                : any;                                   /** arguments */
                
    // for Processor 
    num_build_done      = 0;                                     /** */
    num_build_seen      = 0;                                     /** */
    num_build_exec      = 0;                                     /** */
    loaded_from_db      = false;                                 /** true if already loaded from the database */
    done_cbs            = new Array<( err: boolean ) => void>(); /** waiting done_cb */
    start               : [ number, number ]; // time
 
    // output saved to the db, re-used between builds     
    outputs             = new Array<string>();                   /** output files (generated or not) */
    output_mtimes       = new Array<number>();                   /** modification time of outputs when done */
    exe_data            = {} as any;                             /** output data structure */
    generated           = new Array<string>();                   /** generated files (must be deleted if redo or clean, ...) */
    generated_mtimes    = new Array<number>();                   /** modification time of outputs when done */
    file_dependencies   = new FileDependencies;

    // intermediate outputs
    additional_children = new Array<CompilationNode>();          /** children added during execution */
    pure_function       = true;                                  /** true is different execution with the same parameters yield the same results */
} 
 
