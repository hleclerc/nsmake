#include "CppParser.h"

void repl( std::string &subject, const std::string& search, const std::string& replace) {
    size_t pos = 0;
    while ( ( pos = subject.find( search, pos ) ) != std::string::npos ) {
         subject.replace( pos, search.length(), replace );
         pos += replace.length();
    }
}

// argv[ 1 ] -> filename
// argv[ 2 ] -> dir
// expected data in stdin: base includes, base defines
int main( int argc, char **argv ) {
    std::ifstream f( argv[ 1 ] );
    std::ostringstream os;
    os << f.rdbuf();

    CppParser cprs;

    // read base includes
    std::istringstream base_includes_ss( read_sized() );
    std::string include;
    while ( std::getline( base_includes_ss, include ) )
        cprs.base_include_paths.push_back( include );

    // read base defines
    cprs.parse( "base defines", "", read_sized(), 0, false );

    // parse
    cprs.parse( argv[ 1 ], argv[ 2 ], os.str(), nullptr, true, 0 );

    // save content if necessary
    if ( cprs.need_cpp_dump ) {
        // -> ask for a filename, wait for the answer
        std::cout << "D" << std::endl;
        std::string filename = read_sized();

        // add missing linemakers
        for( unsigned i = cprs.linemakers_to_insert.size(); i--; ) {
            const std::pair<size_t,std::string> &li = cprs.linemakers_to_insert[ i ];
            size_t pos = cprs.cpp_content.find( '\n', li.first );
            if ( pos != std::string::npos )
                cprs.cpp_content.insert( pos, li.second );
        }

        // replace __NSMAKE_FILE__ to chosen filename
        repl( cprs.cpp_content, " __NSMAKE_FILE__", " \"" + filename + "\"" );

        // save the content
        write_file( filename, cprs.cpp_content );
    }

    return 0;
}
