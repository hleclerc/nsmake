#include "CppCompiler.h"
#include <string.h>
using namespace std;

int main() {
    while ( true ) {
        try {
            // wait for a new message
            Json::Value root = Task::wait_for_line();
            std::string service = root[ "type" ].asString();

            if ( service == "CppCompiler" ) {
                // currently we only have one kind of service... so launch it
                CppCompiler cppc( root );
                cppc.exec();

                // done (synchronously)
                Task::send_done( &cppc );
            } else {
                throw "There's no service named " + service + " in " + __FILE__ + ".";
            }

        } catch ( string msg ) {
            if ( msg.length() ) std::cerr << msg << std::endl;
            Task::send_done();

        } catch ( const char *msg ) {
            if ( strlen( msg ) ) std::cerr << msg << std::endl;
            Task::send_done();

        } catch ( const Json::LogicError &msg ) {
            std::cerr << "Error: CppCompiler: while parsing Json: " << msg.what() << std::endl;
            Task::send_done();
        }
    }
}
