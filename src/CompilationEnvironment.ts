import CommunicationEnvironment from "./CommunicationEnvironment";
import FileDependencies         from "./FileDependencies";
import CompilationNode, 
     { Degraded }               from './CompilationNode';
import ArgumentParser           from './ArgumentParser';
import Generator                from "./Generator";
import { pu }                   from "./ArrayUtil";
import * as async               from 'async'
import * as path                from 'path'        
        
import GeneratorCodegen         from "./GeneratorCodegen";
import GeneratorCpp             from "./GeneratorCpp";
import GeneratorSh              from "./GeneratorSh";
import GeneratorPy              from "./GeneratorPy";
import GeneratorId              from "./GeneratorId";
import GeneratorJs              from "./GeneratorJs";

export declare type GcnItem = {
    prio: number;
    func: ( target: string, output: string, cwd: string, cb: ( cn: CompilationNode ) => void, for_found: FileDependencies, care_about_target: boolean, allow_generation: boolean ) => void;
};

export
class CompilationPlugins {
    generators = new Array<typeof Generator>();
}

/** compilation context */
export default 
class CompilationEnvironment {
    constructor( com: CommunicationEnvironment, cwd: string, args = {} as any, cns = new Array<CompilationNode>(), plugins = null as CompilationPlugins, parent = null as CompilationEnvironment ) {
        this.com     = com;
        this.cwd     = cwd;
        this.args    = args;
        this.cns     = cns;
        this.parent  = parent;
        this.plugins = plugins;
        
        // add the default generators
        this.add_generator( GeneratorCodegen );
        this.add_generator( GeneratorCpp     );
        this.add_generator( GeneratorPy      );
        this.add_generator( GeneratorSh      );
        this.add_generator( GeneratorJs      );
        this.add_generator( GeneratorId      );

        // generators from plugins
        if ( plugins )
            for( const G of plugins.generators )
                this.add_generator( G );
    }

    /** */
    add_generator( T: typeof Generator ) {
        const generator = new T( this );

        this.generators.push( generator );

        try {
            generator.get_gcn_funcs( this.gcn_funcs );
        } catch ( e ) {
            this.com.error( null, `Pb with generator${ T.src ? ` '${ T.src }'` : "" }: ${ e }\n${ e.stack }` );
        }

        // sort (again)
        this.gcn_funcs.sort( function( a, b ) { return b.prio - a.prio; } );
    }

    /** beware: mod_args must not contain references to CompilationNode, excepted if with in additional_cns, with an offset of this.cns.length */
    clone( mod_args: any, additional_cns = new Array<CompilationNode>() ): CompilationEnvironment {
        return new CompilationEnvironment( this.com, this.cwd, Object.assign( {}, this.args, mod_args ), [ ...this.cns, ...additional_cns ], this.plugins, this.parent );
    }

    /** */
    make_child( args: any, cns: Array<CompilationNode> ): CompilationEnvironment {
        return new CompilationEnvironment( this.com, this.cwd, args, cns, this.plugins, this );
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
        p.add_argument( [], [], 'time-limit'  , 'Set time limit for execution' );

        p.set_mission_description( 'clean'  , [], 'remove all the output files'                                                                         );
        p.set_mission_description( 'prerequ', [], 'check for prerequisites'                                                                             );
        p.set_mission_description( 'stop'   , [], 'stop the server'                                                                                     );
        p.set_mission_description( 'help'   , [], 'get help, generic, or for a given mission (in [__MISSION_TYPES__]) or universe (in [__UNIVERSES__])' );
        p.set_mission_description( 'run'    , [], '...'                                                                                                 );
        p.set_mission_description( 'sleep'  , [], 'wait for n milliseconds'                                                                             );
        p.set_mission_description( 'status' , [], 'display information about the server'                                                                );

        p.add_positional_argument( [ 'help'              ], 'help-args'  , 'mission(s) or universe(s) to focus on', 'string*' );
        p.add_positional_argument( [ 'prerequ'           ], 'prerequs'   , 'needed prerequisite(s)'               , 'string*' );
        p.add_positional_argument( [ 'exe', 'run', 'lib' ], 'entry-point', 'name of the sourcefile'               , 'cn'      );
        p.add_positional_argument( [ 'run'               ], 'arguments'  , "arguments passed to the executable"   , 'string*' );
        p.add_positional_argument( [ 'sleep'             ], 'time'       , "time in milliseconds to wait for"     , 'number'  );

        for( let g of this.generators ) {
            try {
                g.decl_additional_options( p );
            } catch ( e ) {
                this.com.error( null, `Pb with generator${ ( g.constructor as any ).src ? ` '${ ( g.constructor as any ).src }'` : "" }: ${ e }` );
            }
        }
    }

    /**  */
    get_compilation_node( target: string, cwd: string, for_found: FileDependencies, cb: ( cn: CompilationNode ) => void, care_about_target = false, allow_generation = true ): void {
        target = path.normalize( target );

        // aliases
        const subs = this.aliases.get( target ) || target;
        
        // test with gcn_funcs in priority order
        async.forEachSeries( this.gcn_funcs, ( gf, foreach_cb ) => {
            gf.func( subs, target, cwd, foreach_cb, for_found, care_about_target, allow_generation );
        }, cb );
    }

    /** in inp_cns CompilationNode arre assumed to be done (outputs are ok, ...) */
    get_mission_node( file_dependencies: FileDependencies, cb: ( mission_node: CompilationNode ) => void ): void {
        switch ( this.args.mission ) {
            case "sleep":
                return cb( new CompilationNode( `Sleep(${ this.args.time })`, "Sleep", [], { time: typeof this.args.time == "undefined" ? 1000 : this.args.time } ) );
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
        pu( this.args[ env_var ], value );
    }

    /** */
    New( type: string, children: Array<CompilationNode>, args: any, degraded = null as Degraded  ): CompilationNode {
        return this.com.proc.pool.New( type, children, args, degraded );
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
    plugins    : CompilationPlugins;       /** */

    aliases    = new Map<string,string>(); /** as in `nsmake alias visible_filename internal_name_used` */ 
} 

