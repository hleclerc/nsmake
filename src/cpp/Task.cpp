#include "System/Parsing.h"
#include "System/N.h"
#include "Task.h"

template<class ...Args,int n>
void _make_json_from_tuple( Json::Value &res, const std::tuple<Args...> &t, N<n> ) {
    res[ std::get< 2 * ( n - 1 ) + 0 >( t ) ] = to_json( std::get< 2 * ( n - 1 ) + 1 >( t ) );
    _make_json_from_tuple( res, t, N< n - 1 >() );
}
template<class ...Args>
void _make_json_from_tuple( Json::Value &, const std::tuple<Args...> &, N<0> ) {
}


template<class ...Args>
Json::Value _unzip( const Args& ...args ) {
    Json::Value res( Json::objectValue );
    _make_json_from_tuple( res, std::tie( args... ), N< sizeof...( Args ) / 2 >() );
    return std::move( res );
}

#define SAWA( ACTION, ... ) _send_and_wait( ACTION, _unzip( __VA_ARGS__ ) )
#define SEND( ACTION, ... ) _send( ACTION, _unzip( __VA_ARGS__ ) )

Task::Task( const Json::Value &root ) : exe_data( Json::objectValue ) {
    pure_function = true;
    err           = false;

    // read data from root
    args      = root[ "args" ];
    signature = root[ "signature" ].asString();
    for( const Json::Value &ch : root[ "children" ] )
        children.push_back( Task::CnData{ from_json( ch[ "signature" ] ), from_json( ch[ "outputs" ] ), ch[ "exe_data" ] } );
}

void Task::error( std::string msg ) {
    SEND( "error", "msg", msg );
}

void Task::note( std::string msg ) {
    SEND( "note", "msg", msg );
}

void Task::info( std::string msg ) {
    SEND( "info", "msg", msg );
}

std::string Task::read_file_sync(std::string name) {
    std::ifstream is( name.c_str() );
    std::ostringstream os;
    os << is.rdbuf();
    return os.str();
}

void Task::write_file_sync( std::string name, const std::string &content ) {
    std::ofstream os( name.c_str() );
    os << content;
}

void Task::_send( const std::string &action, const Json::Value &args ) {
    Json::Value cmd( Json::objectValue );
    cmd[ "action" ] = action;
    cmd[ "args"   ] = args;
    cmd[ "msg_id" ] = 0;

    Json::FastWriter fw;
    std::cout << fw.write( cmd );
}

Json::Value Task::_send_and_wait( const std::string &action, const Json::Value &args ) {
    _send( action, args );
    Json::Value ans = wait_for_line();
    if ( ans[ "err" ].asBool() )
        throw "";
    return ans[ "res" ];
}

Json::Value Task::wait_for_line() {
    while ( true ) {
        // wait
        std::string line;
        std::getline( std::cin, line );
        if ( line.empty() )
            continue;

        // parse
        Json::Value root( Json::objectValue );
        Json::Reader reader;
        reader.parse( line, root );
        if ( root[ "action" ] == "error" )
            throw root[ "msg" ].asString();
        return root;
    }
}

std::string Task::get_filtered_target_signature( std::string target, std::string cwd ) {
    std::string res = SAWA( "get_filtered_target_signature", "target", target, "cwd", cwd ).asString();
    if ( res.empty() ) throw "Don't known how to read or build '" + target + "'";
    return res;
}

Task::NumAndSignature Task::get_first_filtered_target_signature( std::vector<std::string> targets, std::string cwd ) {
    if ( ! targets.size() )
        return { 0, "" };
    Json::Value res = SAWA( "get_first_filtered_target_signature", "targets", targets, "cwd", cwd );
    return { res[ "num" ].asUInt(), res[ "signature" ].asString() };
}

Task::CnData Task::get_cn_data( std::string signature ) {
    Json::Value res = SAWA( "get_cn_data", "signature", signature );
    return CnData{ signature, from_json( res[ "outputs" ] ), res[ "exe_data" ] };
}

std::string Task::new_build_file( std::string orig, std::string ext, std::string dist ) {
    Json::Value res = SAWA( "new_build_file", "orig", orig, "ext", ext, "dist", dist );
    return from_json( res );
}

int Task::spawn_sync( std::string cwd, std::string cmd, std::vector<std::string> args ) {
    Json::Value res = SAWA( "spawn", "cwd", cwd, "cmd", cmd, "args", args );
    return from_json( res );
}

bool Task::run_install_cmd( std::string category, std::string cwd, std::string cmd, std::vector<std::string> prerequ ) {
    Json::Value res = SAWA( "run_install_cmd", "category", category, "cwd", cwd, "cmd", cmd, "prerequ", prerequ );
    return from_json( res );
}

void Task::register_aliases( const std::vector<std::pair<std::string,std::string> > &aliases, std::string cur_dir ) {
    Json::Value aj( Json::arrayValue );
    for( const std::pair<std::string,std::string> &alias : aliases ) {
        Json::Value item( Json::objectValue );
        item[ "key" ] = resolve( cur_dir, alias.first  );
        item[ "val" ] = resolve( cur_dir, alias.second );
        aj.append( item );
    }
    SEND( "register_aliases", "lst", aj );
}

std::string Task::make_signature( std::string type, std::vector<std::string> children_signatures, Json::Value args ) {
    Json::Value chv( Json::arrayValue );
    for( std::string sgn : children_signatures )
        chv.append( json_parse( sgn ) );

    Json::Value res( Json::arrayValue );
    res.append( type );
    res.append( chv  );
    res.append( args );
    return json_stringify( res );
}

inline bool sp_ch( char c ) {
    return c == '<' || c == '>' || c == '=';
}

std::vector<std::string> tok_system_req( const std::string &sys ) {
    std::vector<std::string> res;
    for( unsigned i = 0; i < sys.size(); ) {
        if ( sp_ch( sys[ i ] ) ) {
            unsigned b = i;
            while ( ++i < sys.size() && sp_ch( sys[ i ] ) );
            res.emplace_back( b, i );
        } else {
            unsigned b = i;
            while ( ++i < sys.size() && ! sp_ch( sys[ i ] ) );
            res.emplace_back( b, i );
        }
    }
    // trim
    for( std::string &str : res ) {
        while ( str.size() && str.back() == ' ' ) str.resize( str.size() - 1 );
        while ( str.size() && str.front() == ' ' ) str = str.substr( 1 );
    }
    return res;
}

bool Task::system_is_in( const std::vector<std::string> &systems, const Json::Value &sys ) {
    if ( systems.size() == 0 )
        return true;

    for( const std::string &str : systems ) {
        const std::vector<std::string> spl = tok_system_req( str );
        if ( spl.empty() )
            continue;
        if ( spl[ 0 ] != sys[ "os" ].asString() && spl[ 0 ] != sys[ "dist" ].asString() )
            continue;
        bool ok = true;
        for( unsigned i = 1; i < spl.size(); i += 2 ) {
            if ( spl[ i ] == "==" ) { if ( sys[ "release" ].asDouble() != std::strtod( spl[ i + 1 ].c_str(), 0 ) ) ok = false; continue; }
            if ( spl[ i ] == ">=" ) { if ( sys[ "release" ].asDouble() <  std::strtod( spl[ i + 1 ].c_str(), 0 ) ) ok = false; continue; }
            if ( spl[ i ] == "<=" ) { if ( sys[ "release" ].asDouble() >  std::strtod( spl[ i + 1 ].c_str(), 0 ) ) ok = false; continue; }
            if ( spl[ i ] == ">"  ) { if ( sys[ "release" ].asDouble() <= std::strtod( spl[ i + 1 ].c_str(), 0 ) ) ok = false; continue; }
            if ( spl[ i ] == "<"  ) { if ( sys[ "release" ].asDouble() >= std::strtod( spl[ i + 1 ].c_str(), 0 ) ) ok = false; continue; }
        }
        if ( ok )
            return true;
    }
    
    return false;
}

void Task::send_done( Task *task ) {
    Json::Value output_summary( Json::objectValue );
    if ( task ) {
        output_summary[ "generated"     ] = to_json( task->generated );
        output_summary[ "outputs"       ] = to_json( task->outputs );
        output_summary[ "pure_function" ] = task->pure_function;
        output_summary[ "exe_data"      ] = task->exe_data;

    }

    Json::Value args( Json::objectValue );
    args[ "output_summary" ] = output_summary;
    args[ "err" ] = task ? task->err : true;

    Json::Value res( Json::objectValue );
    res[ "action" ] = "done";
    res[ "args" ] = args;

    Json::FastWriter fw;
    std::cout << fw.write( res );

}

std::string Task::nsmake_cmd( const std::vector<std::string> &args, const std::string &cwd ) {
    Json::Value make_file_args;
    make_file_args[ "content" ] = args[ 0 ];
    make_file_args[ "orig"    ] = "";
    make_file_args[ "ext"     ] = args.size() >= 2 ? args[ 1 ] : ".cpp";

    std::string sgn_ep = make_signature( "MakeFile", {}, make_file_args );
    std::vector<std::string> signatures;
    signatures.push_back( sgn_ep );

    Json::Value mission_args;
    mission_args[ "entry_point"     ] = 0;
    mission_args[ "redirect"        ] = new_build_file( "nsmake_cmd", ".h" );
    mission_args[ "mission"         ] = "run";
    mission_args[ "cwd"             ] = cwd;
    mission_args[ "arguments"       ] = to_json( args.size() > 2 ? std::vector<std::string>{ args.begin() + 2, args.end() } : std::vector<std::string>{} );
    mission_args[ "pure_function"   ] = true;
    mission_args[ "local_execution" ] = false;

    CnData cn = run_mission_node( mission_args, signatures );
    return read_file_sync( cn.outputs[ 0 ] );
}

std::string Task::nsmake_run( const std::vector<std::string> &args, const std::string &cwd ) {
    std::string sgn_ep = get_filtered_target_signature( resolve( cwd, args[ 0 ] ), cwd );
    std::vector<std::string> signatures;
    signatures.push_back( sgn_ep );

    Json::Value mission_args;
    mission_args[ "entry_point"     ] = 0;
    mission_args[ "redirect"        ] = new_build_file( "nsmake_run", ".h" );
    mission_args[ "mission"         ] = "run";
    mission_args[ "cwd"             ] = cwd;
    mission_args[ "arguments"       ] = to_json( std::vector<std::string>{ args.begin() + 1, args.end() } );
    mission_args[ "pure_function"   ] = true;
    mission_args[ "local_execution" ] = false;

    CnData cn = run_mission_node( mission_args, signatures );
    return read_file_sync( cn.outputs[ 0 ] );
}

Task::CnData Task::run_mission_node( const Json::Value &args, const std::vector<std::string> &signatures ) {
    Json::Value res = SAWA( "run_mission_node", "args", args, "signatures", signatures );
    if ( res[ "outputs" ].isNull() )
        throw "Did not find what to do (what mission) for " + args.toStyledString(); //  + ", signatures = " + std::to_string( signatures );
    CnData out;
    out.outputs   = from_json( res[ "outputs" ] );
    out.signature = res[ "signature" ].asString();
    out.exe_data  = res[ "exe_data" ];
    return out;
}


