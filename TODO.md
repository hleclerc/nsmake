* split cpp parser and compiler
 -> l'intérêt c'est le parallèlisme... mais si on fait linker( compiler( parser ) ), ça ne parallèlise rien.
   Prop 1: on parse tout, et on lance les compilations en parallèle après ça.
   Prop 2: dès qu'on le résultat d'un parse, on lance en parallèle la compilation. On poursuit le link quand le dernier callback de compilation est lancé.
   Pb: on demande un .o... mais on veut un .o_parse et un .o
   Autre prop: chaque .o sort dans son exe_data les paramètres d'exécution (le spawn_sync à faire)
     -> on lance les spawn_sync en parallèle
     -> il faut que les compiler sortent les info de spawn_sync
   
* `system` field in loaders/flag handlers (something more accurate, canonical...)
* ext_lib (cdn)
