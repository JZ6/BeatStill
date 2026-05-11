# TODO 

~~have enemies be different shapes, circle > triangle > square >pentagon etc~~ DONE — each enemy type has a unique polygon shape

~~wiggly line snake enemy for 2 sided enemy?~~ DONE — "snake" enemy type with sine-wave drawing and weaving movement

~~green enemy keeps moving in one direction slowly and fires 12 shots in a circle thats slow~~ DONE — "circler" enemy type (hexagon, green, drifts and fires 12 radial shots)

~~add an unlock system for weapons music etc~~ DONE

~~tutorial bugs~~ DONE

~~add levels inspired by superhot, for instance a level where the player is facing 2 shotgun blast down a hallway for instance~~ DONE

~~in the hallway level the bullets should have already been shot when the user spawns in~~ DONE — Level 1 has pre-fired bullet spreads from both tanks

~~for spiral bullets level the user should spawn into a screen full of bullets, leaving only a spiral path clear.~~ DONE — Level 9 "Bullet Spiral"

~~tutorial sections should less 1 seconds minimum, sometimes multiple steps get skipped~~ DONE — MIN_STEP_MS = 3000ms

~~dont exit level automatically when complete~~ DONE — shows NEXT LEVEL / LEVELS buttons instead

~~auto collect powerups if level complete~~ DONE — all shards collected on level complete

~~level complete should have a button that goes to next level~~ DONE

~~add actual impassable wall objects that we can use to design rooms and hallways etc~~ DONE — 3 wall types: solid (absorbs bullets), bounce (ricochets), glass (destructible)

make drop icons unique to reflect what the player got

make the drops allow user to use it instantly

# Thoughts


improve chaining mechanic 

lets re think the upgrades, should we do it superhot style where each enemy drops its own gun? but that may clutter the screen over time

break each enemy type to its own file and class

add boss

going forward for all work in BeatStill commit after every change, and use yjzuo6@gmail.com as the committer, but do not push anything.