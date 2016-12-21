#include "CppParser/CppParser.h"
#include "System/Parsing.h"
using namespace std;

int main() {
    while ( true ) {
        Task task = Task::New<Task>();
        try {
            // parse
            CppParser cp( task );
            string cpp_name = task.children[ 0 ].outputs[ 0 ];
            string cpp_data = task.read_file_sync( cpp_name );
            cp.parse( cpp_name, dirname( cpp_name ), cpp_data );

            // write new cpp content if necessary
            if ( cp.need_cpp_dump ) {
                cpp_name = task.new_build_file( cpp_name );
                replace_all( cp.cpp_content, "@@__generated_from_NSMAKE_xxx__@@", cpp_name );
                task.write_file_sync( cpp_name, cp.cpp_content );
            }

            // arguments
            string o_name = task.new_build_file( cpp_name, ".o" );
            std::vector<std::string> args;
            args.push_back( "-c" );
            args.push_back( "-o" );
            args.push_back( o_name );
            args.push_back( cpp_name );
            for( const auto &inc : cp.inc_paths ) args.push_back( "-I" + inc );
            for( const auto &inc : cp.cmd_include_paths ) args.push_back( "-I" + inc );

            // compilation
            if ( task.spawn_sync( task.args[ "launch_dir" ].asString(), "g++", args ) )
                throw "";
            task.outputs.push_back( o_name );

            // update of exe_data
            task.exe_data[ "orig_name" ] = task.children[ 0 ].exe_data[ "orig_name" ].isString() ?
                        task.children[ 0 ].exe_data[ "orig_name" ].asString() :
                        cpp_name;
            for( const auto &inc : cp.includes )
                task.exe_data[ "includes" ].append( inc );
            for( const auto &inc : cp.include_strs )
                task.exe_data[ "include_strs" ].append( inc );
            for( const auto &inc : cp.lib_paths )
                task.exe_data[ "lib_paths" ].append( inc );
            for( const auto &inc : cp.lib_names )
                task.exe_data[ "lib_names" ].append( inc );
            for( const auto &inc : cp.obj_names )
                task.exe_data[ "obj_names" ].append( inc );
        } catch ( std::string msg ) {
            if ( msg.length() ) task.error( msg );
            task.err = true;
        } catch ( const char *msg ) {
            if ( strlen( msg ) ) task.error( msg );
            task.err = true;
        } catch ( Json::LogicError msg ) {
            task.error( "Error: CppParser: while parsing Json: " + string( msg.what() ) );
            task.err = true;
        }
    }
}
