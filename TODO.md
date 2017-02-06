* node consumes A LOT of memory ! Microservices and stuff
  * should not be written in js if possible
  * should be reused in "waiting" state if possible (ok with fibers but currently a service is expected to handle only 1 cn at a time)
* les pu qui ne sont pas fait avec GenOp. On peut tester avec interruption pendant gen code
  => on ne refait pas les enfants que le parent est declaré ok !
  Prop 1: on merge aussi les pu
* more parallelism in jsdepfactory
* update tests for the project
* `$LIB_VERSION`
