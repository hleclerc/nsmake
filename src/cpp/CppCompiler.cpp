#include "CppParser/CppParser.h"
#include "CppCompiler.h"
using namespace std;

CppCompiler::CppCompiler( const Json::Value &root ) : Task( root ) {
}

void CppCompiler::exec() {
    string cpp_name = children[ 0 ].outputs[ 0 ];
    string orig_name = children[ 0 ].exe_data[ "orig_name" ].isString() ? children[ 0 ].exe_data[ "orig_name" ].asString() : cpp_name;

    // parse
    CppParser cp( this );
    string cpp_data = read_file_sync( cpp_name );
    cp.parse( cpp_name, dirname( cpp_name ), cpp_data );

    // write new cpp content if necessary
    if ( cp.need_cpp_dump ) {
        cpp_name = new_build_file( cpp_name );
        replace_all( cp.cpp_content, "@@__generated_from_NSMAKE_xxx__@@", cpp_name );
        write_file_sync( cpp_name, cp.cpp_content );
    }

    // arguments
    Json::Value cmds( Json::arrayValue );
    Json::Value nbfs( Json::arrayValue );
    Json::Value outs( Json::arrayValue );

    cmds.append( "-o" );
    if ( args[ "output" ].isString() && args[ "output" ].asString().size() ) {
        cmds.append( args[ "output" ].asString() );
        outs.append( args[ "output" ].asString() );
    } else {
        // new_build_files.push( { orig: orig_name, ext: ".o" } );
        Json::Value nbf( Json::objectValue );
        nbf[ "orig" ] = cpp_name;
        nbf[ "ext" ] = ".o";
        nbfs.append( nbf );

        cmds.append( -1 );
        outs.append( -1 );
    }

    cmds.append( "-c" );
    cmds.append( cpp_name );
    for( const auto &cpf : cp.cpp_flags         ) append_unique( cmds, cpf );
    for( const auto &inc : cp.inc_paths         ) append_unique( cmds, "-I" + inc );
    for( const auto &inc : cp.cmd_include_paths ) append_unique( cmds, "-I" + inc );

    //
    string compiler = cp.cxx_name.size() ? cp.cxx_name : from_json( children[ 2 ].exe_data[ "compiler"  ] );

    // update of exe_data
    exe_data[ "orig_name" ] = orig_name;
    for( const auto &inc : cp.includes     ) exe_data[ "includes"     ].append( inc );
    for( const auto &inc : cp.include_strs ) exe_data[ "include_strs" ].append( inc );
    for( const auto &inc : cp.lib_paths    ) exe_data[ "lib_paths"    ].append( inc );
    for( const auto &inc : cp.lib_names    ) exe_data[ "lib_names"    ].append( inc );
    for( const auto &inc : cp.obj_names    ) exe_data[ "obj_names"    ].append( inc );

    // output cmd
    Json::Value exe_args( Json::objectValue );
    exe_args[ "executable"      ] = compiler;
    exe_args[ "args"            ] = cmds;
    exe_args[ "new_build_files" ] = nbfs;
    exe_args[ "outputs"         ] = outs;

    exe_data[ "command_sgn" ] = make_signature( "Executor", { signature }, exe_args );
    exe_data[ "compiler"    ] = compiler;
}
