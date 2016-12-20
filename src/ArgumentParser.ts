import * as path from "path";

/** */
declare type ArgumentType = 'boolean' | 'string' | 'string*' | 'path' | 'path*' | 'cn' | 'cn*' | "number";

/** */
class Argument {
    short    : string;
    long     : string;
    help     : string;
    type     : ArgumentType;
    missions : Array<string>; /** Missions that use this argument */
    universes: Array<string>; /** Universes (Js, C, ...) that use this argument */
}

/** */
class PositionalArgument {
    name   : string;
    help   : string;
    type   : ArgumentType;
}

/** */
class Mission {
    description: string;
    universes  : Array<string>; /**  */
    may_use    : Array<string>; /** mission that this may use */
}

/** Small utility for argument parsing with one level of subparsing */
export default
class ArgumentParser {
    constructor( prg_name: string, description: string, version: string ) {
        this.prg_name    = prg_name   ;
        this.description = description;
        this.version     = version    ;

        this.add_argument( [], [], 'h,help', `Get this help message. '${ prg_name } --help {__MISSION_TYPES__}' or '${ prg_name } --help {__UNIVERSES__}' to get information for a given mission or universe`, 'boolean' );
    }

    /** add a description for this or for a given mission */
    set_mission_description( mission: string, universes: Array<string>, description: string, may_use = [] ): void {
        const om = this.missions.get( mission );
        if ( om ) {
            om.universes.push( ...universes );
            for( let m of may_use )
                if ( om.may_use.indexOf( m ) < 0 )
                    om.may_use.push( m );
            return;
        }
        this.missions.set( mission, {
            description,
            universes,
            may_use
        } );
    }

    /** add an argument for this or for a given mission. names == null => specifiy help for a positional argument */
    add_argument( missions: Array<string>, universes: Array<string>, names: string, help: string, type = 'string' as ArgumentType ): void {
        const short = names.split( ',' ).find( x => x.length == 1 ) || null;
        const long  = names.split( ',' ).find( x => x.length >  1 ) || null;
        for( let arg of this.args ) {
            if ( ( arg.short && arg.short == short ) || ( arg.long && arg.long == long ) ) {
                if ( arg.short != short )
                    console.error( `Arg defined by ${ long } appears several times, but with different short names.` );
                if ( arg.long != long )
                    console.error( `Arg defined by ${ short } appears several times, but with different long names.` );
                if ( arg.type != type )
                    console.error( `Arg defined by ${ names } appears several times, but with different types.` );
                arg.missions .push( ...missions  );
                arg.universes.push( ...universes );
                return;
            }
        }
        this.args.push( { short, long, universes, missions, help, type } );
    }

    /**  */
    add_positional_argument( missions: Array<string>, name: string, help: string, type = 'string' as ArgumentType ): void {
        for( let u of missions ) {
            if ( ! this.positional.get( u ) )
                this.positional.set( u, [] );
            this.positional.get( u ).push( { name, help, type } );
        }
    }

    /** return { _error: true, _msg: '...' } if went wrong */
    parse_args( res: any, targets: Array<string>, args: Array<string>, cur_dir: string ): void {
        function error( msg: string ) {
            res._error = true;
            res._msg = msg;
        };

        try {
            let num_positional = -1;
            for( let num_arg = 0; num_arg < args.length; ++num_arg ) {
                const val = args[ num_arg ];
                if ( val.startsWith( '--' ) ) {
                    this._use_arg( res, targets, val.slice( 2 ), cur_dir, () => {
                        if ( ++num_arg >= args.length )
                            throw `'${ val }' must be followed by a value`;
                        return args[ num_arg ];
                    } );
                } else if ( val.startsWith( '-' ) ) {
                    for( let nsv = 1; nsv < val.length; ++nsv ) {
                        const sv = val[ nsv ];
                        this._use_arg( res, targets, val[ nsv ], cur_dir, () => {
                            const nsv_p1 = nsv + 1; 
                            if ( nsv_p1 < val.length ) {
                                nsv = val.length;
                                return val.slice( nsv_p1 );
                            }
                            if ( ++num_arg >= args.length )
                                throw `'-${ sv }' must be followed by a value`;
                            return args[ num_arg ];
                        } );
                    }
                } else if ( num_positional < 0 ) {
                    // mission type
                    res.mission = args[ num_arg ];
                    if ( ! this.missions.get( res.mission ) ) {
                        // try to complete the mission name
                        let pos = new Array<string>();
                        for( let trial of this.missions.keys() )
                            if ( trial.startsWith( args[ num_arg ] ) )
                                pos.push( trial );
                        if ( pos.length >= 2 )
                            return error( `Error: ambiguous mission type: '${ args[ num_arg ] }' can be the prefix of ${ pos.map( x => "'" + x + "'" ).join( " or " ) }` );
                        if ( pos.length == 0 )
                            return error( `Error: unknown mission type '${ res.mission }'` );
                        res.mission = pos[ 0 ];
                    }
                    num_positional = 0;
                } else {
                    // positional argument
                    const pag = this.positional.get( res.mission );
                    if ( ! pag )
                        return error( `mission ${ res.mission } do not accept positional arguments` );
                    if ( num_positional > pag.length )
                        return error( `too much positional arguments (for mission ${ res.mission })` );
                    const arg = pag[ num_positional++ ];
                    const attr = arg.name.replace( /-/g, "_" );
                    switch ( arg.type ) {
                        case 'string':
                            res[ attr ] = args[ num_arg ];
                            break;
                        case 'string*':
                            res[ attr ] = args.slice( num_arg );
                            num_arg = args.length - 1;
                            break;
                        case 'path':
                            res[ attr ] = path.resolve( cur_dir, args[ num_arg ] );
                            break;
                        case 'path*':
                            res[ attr ] = args.slice( num_arg ).map( p => path.resolve( cur_dir, p ) );
                            num_arg = args.length - 1;
                            break;
                        case 'cn':
                            res[ attr ] = targets.push( path.resolve( cur_dir, args[ num_arg ] ) ) - 1; 
                            break;
                        case 'cn*':
                            res[ attr ] = new Array<number>();
                            for( let arg of args.slice( num_arg ) )
                                res[ attr ].push( targets.push( path.resolve( cur_dir, arg ) ) - 1 ); 
                            num_arg = args.length - 1;
                            break;
                        default:
                            return error( `module definition error: unknown argument type '${ arg.type }' (for a positional argument)` );
                    }
                }
            }
            return res;
        } catch ( e ) {
            return error( e as string );
        }
    }

    format_help( args: any, nb_columns = 100000 ): string {
        //
        let allowed_missions = new Array<string>(), allowed_universes = new Array<string>();
        if ( args.mission == 'help' ) {
            for( let arg of args.help_args )
                ( this.missions.get( arg ) ? allowed_missions : allowed_universes ).push( arg );
        } else if ( args.mission )
            allowed_missions.push( args.mission );

        //
        const get_mission_messages = ( on_msg: ( title: string, msg: string ) => void ) => {
            this.missions.forEach( ( desc, mission ) => {
                if ( allowed_universes.length == 0 || desc.universes.length == 0 || allowed_universes.find( u => desc.universes.indexOf( u ) >= 0 ) )
                    on_msg( mission, desc.description );
            } );
        };
        const get_arg_messages = ( on_msg: ( title: string, msg: string ) => void ) => {
            const argname_repr = ( arg: Argument ) => {
                return ( arg.short ? '-' + arg.short : '' ) + ( arg.long ? ( arg.short ? ', ' : '' ) + '--' + arg.long : '' );
                // const name = ( arg.short ? '-' + arg.short : '' ) + ( arg.long ? ( arg.short ? ', ' : '' ) + '--' + arg.long : '' );
                // switch ( arg.type ) {
                // case "string" : return name + ` xx`;
                // case "string*": return name + ` xx`;
                // case "path"   : return name + ` path`;
                // case "path*"  : return name + ` path,...`;
                // case "target" : return name + ` target`;
                // case "target*": return name + ` target`;
                // case "boolean": return name;
                // }
            }
            this.args.forEach( arg => {
                if ( ( allowed_missions .length == 0 || arg.missions .length == 0 || allowed_missions .find( u => arg.missions .indexOf( u ) >= 0 ) ) &&
                     ( allowed_universes.length == 0 || arg.universes.length == 0 || allowed_universes.find( u => arg.universes.indexOf( u ) >= 0 ) ) )
                    on_msg( argname_repr( arg ), arg.help );
            } );
        };
        const get_positional_messages = ( mission, on_msg: ( title: string, msg: string ) => void ) => {
            const argname_repr = ( arg: PositionalArgument ) => {
                switch ( arg.type ) {
                case "string" : return arg.name;
                case "string*": return `[${ arg.name }*]`;
                case "path"   : return arg.name;
                case "path*"  : return `[${ arg.name }*]`;
                case "cn"     : return arg.name;
                case "cn*"    : return `[${ arg.name }*]`;
                case "number" : return arg.name;
                }
            }

            const pas = this.positional.get( mission );
            if ( pas )
                for( let pa of pas )
                    on_msg( argname_repr( pa ), pa.help );
        };

        // 
        let mla = 0;
        if ( allowed_missions.length == 0 )
            get_mission_messages( ( title, msg ) => mla = Math.max( mla, title.length ) ); 
        get_arg_messages( ( title, msg ) => mla = Math.max( mla, title.length ) ); 

        //
        let res = '';
        const add_line = ( beg: string, msg: string, len = beg.length ) => {
            if ( msg.match( '__MISSION_TYPES__' ) )
                msg = msg.replace( '__MISSION_TYPES__', [ ...this.missions.keys() ].join( ', ' ) );
            if ( msg.match( '__UNIVERSES__' ) )
                msg = msg.replace( '__UNIVERSES__', this.get_universes().join( ', ' ) );

            const ml = nb_columns - beg.length;
            res += beg;
            while ( msg.length > ml ) {
                let a = msg.lastIndexOf( ' ', ml );
                if ( a < 0 )
                    a = ml;
                res += msg.slice( 0, a ) + "\n" + ' '.repeat( len );
                msg = msg.slice( a ).trim();
            }
            res += msg + '\n';
        }

        // generic description
        // if ( ! msg ) res += String.fromCharCode( 27 ) + '[1m'; 
        // if ( ! msg ) res += String.fromCharCode( 27 ) + '[0m'; 
        res +=`${ this.prg_name }, ${ this.description }\n\n`;

        let lst = [], filuni = '';
        if ( allowed_missions .length ) lst.push( `mission${  allowed_missions.length > 1 ? `s [${ allowed_missions.join( ', ' ) }]` : " '" + allowed_missions[ 0 ] + "'" }` );
        if ( allowed_universes.length ) lst.push( filuni = `universe${ allowed_universes.length > 1 ? `s [${ allowed_universes.join( ', ' ) }]` :  " '" + allowed_universes[ 0 ] + "'" }` );
        const filter = lst.length ? ` for ${ lst.join( ' and ' ) }` : "";

        // usege line.
        if ( allowed_missions.length ) {
            for( let mission of allowed_missions ) {
                let args = [];
                get_arg_messages( ( title, msg ) => args.push( `[${ title }]` ) );
                args.push( mission ); 
                get_positional_messages( mission, ( title, msg ) => args.push( title ) );
                res += `Usage${ filter }:\n`;
                add_line( '  ', `${ this.prg_name } ${ args.join( ' ' ) }` );
            }
            res += `\n`;
        } else {
            let missions = [];
            get_mission_messages( ( title, msg ) => missions.push( title ) );

            let args = [];
            get_arg_messages( ( title, msg ) => args.push( `[${ title }]` ) );
            args.push( `{${ missions.join( ',' ) }} [mission arguments...]` );
            res += `Usage${ filter }:\n`;
            add_line( '  ', `${ this.prg_name } ${ args.join( ' ' ) }` );
            res += `\n`;

            res += `Mission types${ filuni ? ` for ${ filuni }` : "" }:\n`;
            get_mission_messages( ( title, msg ) => add_line( `  ${ title + ' '.repeat( mla - title.length ) }: `, msg ) );
            res += '\n';
        }

        res += `Optional arguments${ filter }:\n`;
        get_arg_messages( ( title, msg ) => {
            add_line( `  ${ title + ' '.repeat( mla - title.length ) }: `, msg );
        } );
        res += '\n';
   
        for( let mission of allowed_missions ) {
            res += `Positional arguments for mission '${ mission }':\n`;
            get_positional_messages( mission, ( title: string, msg: string ) => {
                add_line( `  ${ title + ' '.repeat( mla - title.length ) }: `, msg );
            } );
        }

        return res;
    }

    get_universes(): Array<string> {
        let res = new Set<string>();
        for( let m of this.missions.values() )
            for( let u of m.universes )
                res.add( u );
        for( let a of this.args )
            for( let u of a.universes )
                res.add( u );
        return [ ...res ];
    }

    _use_arg( res: any, targets: Array<string>, name: string, cur_dir: string, get_next: () => string ) {
        // find arg
        const arg = name.length > 1 ?
            this.args.find( arg => name == arg.long ) :
            this.args.find( arg => name == arg.short );
        if ( ! arg )
            throw `Error: unrecognized option '${ ( name.length > 1 ? '--' : '-' ) + name }'`;

        // fill res
        const attr = arg.long.replace( /-/g, "_" );
        switch ( arg.type ) {
            case 'boolean':
                res[ attr ] = true;
                break;
            case 'string':
                res[ attr ] = get_next();
                break;
            case 'string*':
                if ( ! res[ attr ] )
                    res[ attr ] = [];
                res[ attr ].push( get_next() );
                break;
            case 'path':
                res[ attr ] = path.resolve( cur_dir, get_next() );
                break;
            case 'path*':
                if ( ! res[ attr ] )
                    res[ attr ] = [];
                for( let p of get_next().split( ',' ) )
                    res[ attr ].push( path.resolve( cur_dir, p ) );
                break;
            case 'cn':
                res[ attr ] = targets.push( path.resolve( cur_dir, get_next() ) ) - 1;
                break;
            case 'cn*':
                if ( ! res[ attr ] )
                    res[ attr ] = [];
                for( let p of get_next().split( ',' ) )
                    res[ attr ].push( targets.push( path.resolve( cur_dir, p ) ) - 1 );
                break;
            case 'string':
                res[ attr ] = Number( get_next() );
                if ( isNaN( res[ attr ] ) )
                    throw `Error: '${ arg.long }' must be a number`;
                break;
            default:
                throw `Unknown argument type '${ arg.type }'`;
        }
    }

    prg_name    = "";
    description = "";
    version     = "";
    missions    = new Map<string,Mission>();
    args        = new Array<Argument>();
    positional = new Map<string,Array<PositionalArgument>>(); /** help on positional arguments for each mission type */
}
