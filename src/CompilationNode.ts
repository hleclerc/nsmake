import FileDependencies from "./FileDependencies"

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

    _init_for_build() {
        this.additional_children.length = 0;
        this.outputs.length             = 0;
        this.exe_data                   = {};
        this.pure_function              = true;
        this.num_build_exec             = this.num_build_seen;
        this.start                      = process.hrtime() as [ number, number ];
        this.file_dependencies.clear();
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
 
    // output save to the db, re-used between builds     
    outputs             = new Array<string>();                   /** output files (generated or not) */
    output_mtimes       = new Array<number>();                   /** modification time of outputs when done */
    exe_data            = {} as any;                             /** output data structure */
    generated           = new Array<string>();                   /** generated files (must be deleted if redo or clean, ...) */
    file_dependencies   = new FileDependencies;

    // intermediate outputs
    additional_children = new Array<CompilationNode>();          /** children added during execution */
    pure_function       = true;                                  /** true is different execution with the same parameters yield the same results */
} 
 
