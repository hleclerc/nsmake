'SOURCE-MAP-SUPPORT';
'VAR PROCESS';
( function( modules ) {
    var installed_modules = {};
    var hmr = {
        poll          ( delay?: number, url?: string ) { hmrError(); },
        lookForUpdates( cb: ( err: string ) => void, url?: string ) { hmrError(); },
        perpetuate<T> ( val: T ): T { return val; },
    }; 
    // requires will be replaced by call to __nsmake_require__   
    function __nsmake_require__( id: string ) {
        if ( installed_modules[ id ] )
            return installed_modules[ id ].exports;
        var module = installed_modules[ id ] = {
            exports: {},
            loaded : false
        };
        modules[ id ].call( module.exports, module, module.exports, __nsmake_require__, hmr );
        module.loaded = true;
        return module.exports;
    }
    function hmrError() {
        console.error( "Application is not compiled with hmr support (one can use for instance '//// nsmake need_hmr')" );
    }

    return __nsmake_require__( 'ID_MAIN_MODULE' );
} )( {
'BEG_MODULE_DATA': 0 
} );
