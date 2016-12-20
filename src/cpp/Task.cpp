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

#define SAWA( ACTION, ... ) _send_and_wait( _unzip( "action", ACTION, ##__VA_ARGS__ ) )
#define SEND( ACTION, ... ) _send( _unzip( "action", ACTION, ##__VA_ARGS__ ) )

Task::Task( const Json::Value &root ) : exe_data( Json::objectValue ) {
    pure_function = true;
    err           = false;
    args          = root[ "args" ];

    for( const Json::Value &ch : root[ "children" ] )
        children.push_back( CnData{ from_json( ch[ "signature" ] ), from_json( ch[ "outputs" ] ), ch[ "exe_data" ] } );
}

Task::~Task() {
    Json::Value res( Json::objectValue );
    res[ "err" ] = err;
    res[ "action" ] = "done";
    res[ "output_summary" ][ "outputs"       ] = to_json( outputs );
    res[ "output_summary" ][ "generated"     ] = to_json( generated );
    res[ "output_summary" ][ "exe_data"      ] = exe_data;
    res[ "output_summary" ][ "pure_function" ] = pure_function;

    Json::FastWriter fw;
    std::cout << fw.write( res );
}

void Task::error( std::string msg ) {
    SEND( "error", "msg", msg );
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

void Task::_send( const Json::Value &args ) {
    Json::FastWriter fw;
    std::cout << fw.write( args );
}

Json::Value Task::_send_and_wait( const Json::Value &args ) {
    _send( args );
    return _wait_for_line();
}

Json::Value Task::_wait_for_line() {
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
    std::string res = SAWA( "get_filtered_target_signature", "target", target, "cwd", cwd )[ "signature" ].asString();
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
    return from_json( res[ "name" ] );
}

int Task::spawn_sync( std::string cwd, std::string cmd, std::vector<std::string> args ) {
    Json::Value res = SAWA( "spawn", "cwd", cwd, "cmd", cmd, "args", args );
    return from_json( res[ "code" ] );
}

bool Task::run_install_cmd( std::string category, std::string cwd, std::string cmd ) {
    Json::Value res = SAWA( "run_install_cmd", "category", category, "cwd", cwd, "cmd", cmd );
    return from_json( res[ "err" ] );
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


