import CommunicationEnvironment from "./CommunicationEnvironment";
import FileDependencies         from "./FileDependencies";
import CompilationNode          from './CompilationNode';
import ArgumentParser           from './ArgumentParser';
import Generator                from "./Generator";
import * as async               from 'async'
import * as path                from 'path'        
        
import GeneratorCodegen         from "./GeneratorCodegen";
import GeneratorCpp             from "./GeneratorCpp";
import GeneratorId              from "./GeneratorId";
import GeneratorJs              from "./GeneratorJs";

export declare type GcnItem = {
    prio: number;
    func: ( target: string, output: string, cwd: string, cb: ( cn: CompilationNode ) => void, for_found: FileDependencies, care_about_target: boolean ) => void;
};

/** compilation context */
export default 
class CompilationEnvironment {
    constructor( com: CommunicationEnvironment, cwd: string, args = {} as any, cns = new Array<CompilationNode>(), parent = null as CompilationEnvironment ) {
        this.com    = com;
        this.cwd    = cwd;
        this.args   = args;
        this.cns    = cns;
        this.parent = parent;

        // add the default generators
        this.generators.push( new GeneratorCodegen( this ) );
        this.generators.push( new GeneratorCpp    ( this ) );
        this.generators.push( new GeneratorJs     ( this ) );
        this.generators.push( new GeneratorId     ( this ) );

        // get functions for `get_target`
        for( let g of this.generators )
            g.get_gcn_funcs( this.gcn_funcs );
        this.gcn_funcs.sort( function( a, b ) { return b.prio - a.prio; } );
    }

    /** beware: mod_args must not contain references to CompilationNode, excepted if with in additional_cns, with an offset of this.cns.length */
    clone( mod_args: any, additional_cns = new Array<CompilationNode>() ): CompilationEnvironment {
        return new CompilationEnvironment( this.com, this.cwd, Object.assign( {}, this.args, mod_args ), [ ...this.cns, ...additional_cns ], this.parent );
    }

    /** */
    make_child( args: any, cns: Array<CompilationNode> ): CompilationEnvironment {
        return new CompilationEnvironment( this.com, this.cwd, args, cns, this );
    }

    get active(): boolean {
        return this.com.active;
    }

    get verbose(): number {
        if ( this.args.silent       ) return -1;
        if ( this.args.verbose      ) return 1;
        if ( this.args.very_verbose ) return 2;
        return this.parent ? this.parent.verbose : 0;
    }

    decl_additional_options( p: ArgumentParser ) {
        this.com.decl_additional_options( p );

        p.add_argument( [], [], 'dist-dir'    , 'Set directory for public/distribution (i.e. not intermediate) outputs' );

        p.set_mission_description( 'clean', [], 'remove all the output files'                                                                         );
        p.set_mission_description( 'stop' , [], 'stop the server'                                                                                     );
        p.set_mission_description( 'help' , [], 'get help, generic, or for a given mission (in [__MISSION_TYPES__]) or universe (in [__UNIVERSES__])' );
        p.set_mission_description( 'run'  , [], '...'                                                                                                 );
        p.set_mission_description( 'sleep', [], 'wait for n milliseconds'                                                                             );

        p.add_positional_argument( [ 'help'       ], 'help-args'  , 'mission(s) or universe(s) to focus on', 'string*' );
        p.add_positional_argument( [ 'exe', 'run' ], 'entry-point', 'name of the sourcefile)'              , 'cn'      );
        p.add_positional_argument( [ 'run'        ], 'arguments'  , "arguments passed to the executable"   , 'string*' );
        p.add_positional_argument( [ 'sleep'      ], 'time'       , "time in milliseconds to wait for"     , 'number'  );

        for( let g of this.generators )
            g.decl_additional_options( p );
    }

    /**  */
    get_compilation_node( target: string, cwd: string, for_found: FileDependencies, cb: ( cn: CompilationNode ) => void, care_about_target = false ): void {
        target = path.normalize( target );

        // aliases
        const subs = this.aliases.get( target ) || target;
        
        // test with gcn_funcs in priority order
        async.forEachSeries( this.gcn_funcs, ( gf, foreach_cb ) => {
            gf.func( subs, target, cwd, foreach_cb, for_found, care_about_target );
        }, cb );
    }

    /** in inp_cns CompilationNode arre assumed to be done (outputs are ok, ...) */
    get_mission_node( file_dependencies: FileDependencies, cb: ( mission_node: CompilationNode ) => void ): void {
        switch ( this.args.mission ) {
            case "sleep":
                return cb( new CompilationNode( `Sleep(${{ time: this.args.time }})`, "Sleep", [], { time: typeof this.args.time == "undefined" ? 1000 : this.args.time } ) );
            default:
                async.forEachSeries( this.generators, ( generator, foreach_cb ) => {
                    generator.get_mission_node( file_dependencies, foreach_cb );
                }, cb );
        }
    }

    /** */
    register_aliases( cn: CompilationNode, lst: Array< { key: string, val: string} > ) {
        for( const { key, val } of lst ) {
            const ney = path.normalize( key );
            const old = this.aliases.get( ney );
            if ( old ) {
                if ( old != val )
                    this.com.error( cn, `Alias '${ ney }' is defined twice, with different values ('${ old }' and '${ val }')` );
            } else
                this.aliases.set( ney, val );
        }
    }

    /** */
    append_to_env_var( env_var: string, value: any ) {
        if ( typeof this.args[ env_var ] == "undefined" )
            this.args[ env_var ] = [];
        this.args[ env_var ].push( value );
    }

    /** */
    New( type: string, children: Array<CompilationNode>, args: any ): CompilationNode {
        return this.com.proc.pool.New( type, children, args );
    }

    /** */
    arg_rec( name: string, default_value = null ): any {
        if ( this.args[ name ] ) return this.args[ name ];
        return this.parent ? this.parent.arg_rec( name, default_value ) : default_value;
    }

    com        : CommunicationEnvironment; /** client link */
    cwd        : string;                   /** current working directory */
    generators = new Array<Generator>();
    gcn_funcs  = new Array<GcnItem>();

    args       : any;                      /** result of argument parsing */
    cns        : Array<CompilationNode>;   /** */
    parent     : CompilationEnvironment;   /** */

    aliases    = new Map<string,string>(); /** as in `nsmake alias visible_filename internal_name_used` */ 
} 

