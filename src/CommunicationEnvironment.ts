import CompilationNode  from './CompilationNode';
import ArgumentParser   from './ArgumentParser';
import Processor        from "./Processor"
import SpRepr           from "./SpRepr";
import * as net         from 'net'

/** store context for a given build */
export default 
class CommunicationEnvironment {
    constructor( c: net.Socket, proc: Processor, nb_columns: number, color: boolean ) {
        this.c          = c;
        this.proc       = proc;
        this.nb_columns = nb_columns;
        this.color      = color;
    }

    decl_additional_options( p : ArgumentParser ) {
        p.add_argument( [], [], 'silent'      , 'Give no information on what is being built'         , "boolean" );
        p.add_argument( [], [], 'verbose'     , 'Give more information about what is being built'    , "boolean" );
        p.add_argument( [], [], 'very-verbose', 'Give a lot of information about what is being built', "boolean" );
    }

    init() {
    }

    /** launch executable from the client */
    spawn_local( id: string, executable: string, args: Array<string>, redirect = "" ): void {
        this.c.write( `s ${ [ id, redirect, executable, ...args ].map( SpRepr.encode ).join( " " ) }\n` );
    }

    /** launch executable from the client */
    exec_local( id: string, cmd: string, redirect = "" ): void {
        this.c.write( `e ${ [ id, redirect, cmd ].map( SpRepr.encode ).join( " " ) }\n` );
    }

    // communication
    announcement( cn: CompilationNode, msg: string, add_lf = true ) {
        this._msg( cn, 'A', msg, add_lf );
    }

    note( cn: CompilationNode, msg: string, add_lf = true ) {
        this._msg( cn, 'N', msg, add_lf );
    }

    info( cn: CompilationNode, msg: string, add_lf = true ) {
        this._msg( cn, 'I', msg, add_lf );
    }

    error( cn: CompilationNode, msg: string, add_lf = true ) {
        this._msg( cn, 'E', msg, add_lf );
    }

    close_channel( cn: CompilationNode ) {
        if ( this.active && this.channels.has( cn ) )
            this.c.write( `C ${ SpRepr.encode( cn ? cn.signature : '-' ) }\n` );
    }
    
    _msg( cn: CompilationNode, type: string, msg: string, add_lf: boolean ) {
        if ( this.active ) {
            this.c.write( `${ type } ${ SpRepr.encode( cn ? cn.signature : '' ) } ${ SpRepr.encode( msg + ( add_lf ? '\n' : '' ) ) }\n` );
            this.channels.add( cn );
        }
    }

    c          : net.Socket;
    proc       : Processor;
    launch_dir : string;
    nb_columns : number;
    color      : boolean;
    active     = true; /** socket still working ? */
    channels   = new Set<CompilationNode>();
} 

