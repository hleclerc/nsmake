'SOURCE-MAP-SUPPORT';
'VAR PROCESS';

/**  */
class Module {
    static _numChrono = 0;

    constructor( id: string ) {
        this._numChrono = Module._numChrono++;
        this.id         = id;
    }

    accept( mod, cb?: () => void ) { /** Register a function to be called when module mod is modified. Enable to stop "modification propagation": neither this module nor its parents will not be considered as modified */
        if ( typeof mod == "string" )
            this._acceptCbs[ mod ] = cb;
        else
            this._selfAcceptCb = mod;
    }

    perpetuate<T>( val_cb: () => T, key?: string ): T { /** Any an object to survive to a module reload. If key is not defined, it uses a number incremented at each call of perpetuate without key. */
        if ( key ) {
            if( this._mapSurvivors[ key ] )
                return this._mapSurvivors[ key ];
            return this._mapSurvivors[ key ] = val_cb();
        }
        if( this._numSurvivor < this._lstSurvivors.length )
            return this._lstSurvivors[ this._numSurvivor++ ];
        return this._lstSurvivors[ this._numSurvivor++ ] = val_cb();
    }

    _prepareReload() {
        this.exports      = {};
        this.loaded       = false;
        this.seenRequires = [];
        this.firstTime    = false; 
        this._numChrono   = Module._numChrono++;
        this._acceptCbs   = {};
        this._numSurvivor = 0;
    }

    // data managed by nsmake
    exports          = {} as any;
    loaded           = false;
    seenRequires     = new Array<string>();                                      /** require modules loaded so far */
    firstTime        = true;                                                     /** True if this module is loaded for the first time */
    status           = 'new' as 'new' | 'ok' | 'followUp' | 'accept' | 'modified';
    modRequires      = new Array<string>();                                      /** Id of requires that has changed previously */
    id               : string;

    // data that may be modified by the user
    onDispose        = function( keep: boolean ) {};                             /** function that will be called when module is deleted (keep=false) or about to be reloaded (keep=true) */
    data             = null as any;                                              /** data used for perpetuation */

    //
    _numChrono       : number;                                                   /** module number in chronological ordering */
    _acceptCbs       = {} as { [ key: string ]: () => void };
    _selfAcceptCb    = null as () => void;
    _mapSurvivors    = {} as { [ key: string ]: any };
    _lstSurvivors    = new Array<any>();
    _numSurvivor     = 0;
    _acceptCbsToCall = new Array<() => void>();                                  /** list of callback to call during the nxwt _require */
}

/**  */
interface Manifest {
    ep: string; /** entry point */
    md: { [key: string ]: { /** module data */
        build_id: string; /** JSON.stringify( build_id_rec ) */
        url     : string; /** url for the XMLHttpRequest */
        requires: Array<{ b: number, e: number, t: string }>;
        accepts : Array<{ b: number, e: number, t: string }>;
    } }
} 

/**  */
interface ModuleFunc {
    ( module: Module, mod: Module, exports: any, __nsmake_require__: ( id: string ) => any ): void;
}

/** a basic and raw emulator for XMLHttpRequest for the nodejs environment */ 
class __XMLHttpRequest {
    open( type: string, url: string, async: boolean ) {
        this.url = url;
    }
    
    send( data: string ) {
        if ( typeof window === "undefined" ) {
            require( "fs" ).readFile( __dirname + "/" + this.url, ( err, data ) => {
                if ( err )
                    this.status = 404;
                else {
                    this.status = 200;
                    this.responseText = data.toString( "utf8" );
                }
                this.onreadystatechange();
            } );
        }
    }

    onreadystatechange = function() {};
    timeout            = 2000;
    url                = "";
    status             = 200;
    readyState         = 4;
    responseText       = "";
}

/** */
class Hmr {
    constructor( urlManifest: string, buildIds: { [key:string]: string }, moduleFuncs: { [key:string]: ModuleFunc } ) {
        this.urlManifest = urlManifest;
        this.buildIds    = buildIds;
        this.moduleFuncs = moduleFuncs;
    }

    /** call lookForUpdates periodically. By default manifestUrl is the one that was defined at the beginning (urlManifest). Return a function to call to clear the poll */
    poll( delay = 1000 ): { stop: () => void } {
        var cont = true, go = ( err: string ) => {
            setTimeout( () => { if ( cont ) this.lookForUpdates( go ); }, delay );
        }
        go( null );

        return {
            stop() { cont = false; },
        };
    }

    /** Download the last version of the manifest. If stuff is different, reload the modules, call dispose, accept, ... and whatever needed */
    lookForUpdates( cb?: ( err: string ) => void ) {
        var request = this._new_XMLHttpRequest(), url = this.urlManifest;
        request.open( "GET", url, true );
        request.timeout = 10000;
        request.send( null );

        request.onreadystatechange = () => {
            if ( request.readyState != 4 )
                return;
            if ( request.status == 0 ) // timeout
                return cb( "Request for '" + url + "' timed out." );
            if ( request.status !== 200 && request.status !== 304 )
                return cb( "Manifest '" + url + "' is not available (status code=" + request.status.toString() + ")." );
            try {
                var newHmrManifest = JSON.parse( request.responseText ) as Manifest;

                // load new modules functions directly in moduleFuncs
                this._loadNewModules( newHmrManifest, ( err: string, loaded: Array<string> ) => {
                    if ( err )
                        return cb( err );
                    if ( loaded.length == 0 )
                        return cb( null ); // no change
                    this._useNewManifestAndModuleFuncs( newHmrManifest, cb );
                } );
            } catch( e ) {
                cb( e.toString() );
            }
        };
    }

    /** load module that appeared or that has been declared as changed in newHmrManifest */
    _loadNewModules( newHmrManifest: Manifest, cb: ( err_msg: string, loaded: Array<string> ) => void ) {
        let to_load = [] as Array<string>;
        for( let id in newHmrManifest.md )
            if ( ! this.buildIds[ id ] || this.buildIds[ id ] != newHmrManifest.md[ id ].build_id )
                to_load.push( id );
        

        let nb_to_load = to_load.length;
        if ( nb_to_load ) {
            var errors = [] as Array<string>;
            for( let id of to_load ) {
                // console.log( "load:", id );
                let url = newHmrManifest.md[ id ].url;

                let request = this._new_XMLHttpRequest();
                request.open( "GET", url, true );
                request.timeout = 10000;
                request.send( null );

                request.onreadystatechange = () => {
                    if ( request.readyState != 4 )
                        return;

                    if ( request.status == 0 ) // timeout
                        errors.push( "Request to ressource '" + url + "' timed out." )
                    else if ( request.status !== 200 && request.status !== 304 )
                        errors.push( "Ressource '" + url + "' is not available (status code=" + request.status.toString() + ")." )
                    else {
                        let txt = request.responseText, lst = [] as Array<{b:number,e:number,t:string}>;
                        for( let req of newHmrManifest.md[ id ].requires )
                            lst.push( { b: req.b, e: req.e, t: req.t } );
                        for( let req of newHmrManifest.md[ id ].accepts )
                            lst.push( { b: req.b, e: req.e, t: req.t } );
                        lst.sort( ( a, b ) => b.b - a.b );

                        for( let obj of lst ) 
                            txt = txt.substr( 0, obj.b ) + obj.t + txt.substr( obj.e );

                        eval( "this.moduleFuncs[ id ] = function( module, exports, __nsmake_require__ ) { " + txt + "}" );
                    }

                    if ( --nb_to_load == 0 )
                        cb( errors.length ? errors.join( "\n" ) : null, to_load );
                }
            }
        } else {
            cb( null, to_load );
        }
    }

    /** set status of installed modules. TODO: correct mgmt of cyclic references */
    _setModuleStatusRec( newHmrManifest: Manifest, id: string ) {
        let module = this.installedModules[ id ];
        if ( ! module || module.status || ! newHmrManifest.md[ id ] )
            return;

        // by default, 
        module.status = 'followUp';

        // if file has been modified and is not able to self accept
        if ( newHmrManifest.md[ id ].build_id != this.buildIds[ id ] && ! module._selfAcceptCb ) {
            module.status = 'modified';
            for( let cid of module.seenRequires )
                this._setModuleStatusRec( newHmrManifest, cid );
            return;
        }

        // if build ids are different, we necessarily have a module._selfAcceptCb
        module._acceptCbsToCall.length = 0;        
        if ( newHmrManifest.md[ id ].build_id != this.buildIds[ id ] ) {
            module.status = 'accept';
            if ( module._acceptCbsToCall.indexOf( module._selfAcceptCb ) < 0 )
                module._acceptCbsToCall.push( module._selfAcceptCb );
        }

        // look if some children are modified
        module.modRequires.length = 0;
        for( let cid of module.seenRequires ) {
            this._setModuleStatusRec( newHmrManifest, cid );
            if ( this.installedModules[ cid ].status == 'modified' ) {
                const acceptCb = module._acceptCbs[ cid ];
                if ( ! acceptCb )
                    module.status = 'modified';
                else if ( module.status != 'modified' ) {
                    if ( module._acceptCbsToCall.indexOf( acceptCb ) < 0 )
                        module._acceptCbsToCall.push( acceptCb );
                    module.status = 'accept';
                }
                module.modRequires.push( cid );
            }
        }
    }

    _useNewManifestAndModuleFuncs( newHmrManifest: Manifest, cb: ( err: string ) => void ) {
        // remove build ids and module functions that are not needed anymore
        var idsToDelete = [] as Array<string>;
        for( let id in this.moduleFuncs )
            if ( ! newHmrManifest.md[ id ] )
                idsToDelete.push( id );
        for( let id of idsToDelete ) {
            delete this.moduleFuncs[ id ];
            delete this.buildIds[ id ];
        }

        // get status (modified, accept, ...) for each installed module 
        for( let id in this.installedModules )
            this.installedModules[ id ].status = null;
        this._setModuleStatusRec( newHmrManifest, newHmrManifest.ep );

        // delete/dispose modules, in inverse chronological order
        var lstInstalledModules = [] as Array<{ id: string, module: Module }>;
        for( let id in this.installedModules )
            lstInstalledModules.push( { id: id, module: this.installedModules[ id ] } );
        lstInstalledModules.sort( function( a, b ) { return b.module._numChrono - a.module._numChrono } );
        // console.log( "status:", lstInstalledModules.map( x => `${ x.id }: ${ x.module.hot.status }` ) );

        for( let im of lstInstalledModules ) {
            let status = this.installedModules[ im.id ].status; 
            if ( ! status ) {
                if ( im.module.onDispose )
                    im.module.onDispose( false );
                delete this.installedModules[ im.id ];
                delete this.buildIds[ im.id ];
            } else if ( status == 'modified' ) {
                if ( im.module.onDispose )
                    im.module.onDispose( true );
            }
        }

        // update buildIds
        for( let id in newHmrManifest.md )
            this.buildIds[ id ] = newHmrManifest.md[ id ].build_id;            

        //
        this._require( null, newHmrManifest.ep );
        cb( null );
    }

    // requires will be replaced by call to __nsmake_require__   
    _require( orig: Module, id: string ) {
        // register in orig.seenRequires
        if ( orig && orig.seenRequires.indexOf( id ) < 0 )
            orig.seenRequires.push( id );

        // already loaded (with a need for update or not) ?
        var module = this.installedModules[ id ];
        if ( module ) {
            // module or one of its children has to be updated ?
            switch ( module.status ) {
            case 'followUp':
                for( let id of module.seenRequires )
                    this._require( module, id );
                module.status = 'ok';
                break;
            case 'modified':
                module._prepareReload();
                this.moduleFuncs[ id ].call( module.exports, module, module.exports, ( id: string ) => this._require( module, id ) );
                module.loaded = true;
                module.status = 'ok';
                break;
            case 'accept':
                for( let func of module._acceptCbsToCall )
                    func();
                module.status = 'ok';
                break;
            }

            // module output
            return module.exports;
        }

        // make a new module
        module = new Module( id );
        this.installedModules[ id ] = module;

        this.moduleFuncs[ id ].call( module.exports, module, module.exports, ( id: string ) => this._require( module, id ) );
        module.loaded = true;
        return module.exports;
    }

    _new_XMLHttpRequest() : XMLHttpRequest | __XMLHttpRequest {
        return typeof XMLHttpRequest == 'undefined' ? new __XMLHttpRequest : new XMLHttpRequest;
    }

    urlManifest      : string; /** where to find the manifest */
    buildIds         : { [key:string]: string };
    moduleFuncs      : { [key:string]: ModuleFunc };
    installedModules = {} as { [key:string]: Module };
}

/** Global variable for module management */
var hmr = new Hmr( 'URL_MANIFEST', { "BUILD_IDS": "1" }, {
    'BEG_MODULE_DATA': function( module, mod, exports, __nsmake_require__ ) {}
} ); 

/** Launch entry point */
hmr._require( null, 'ID_MAIN_MODULE' );
