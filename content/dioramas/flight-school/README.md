# Flight school

A briefing board, benches, maintenance tool chest, six pilots and crew, and a service cart.
The bounded 48-second cart loop and 20-second walking loop use fixed simulation ticks.
The scene contains ground operations only; Earth supplies nearby boardable aircraft separately.

The catalog places this fictional activity on a mapped Boeing Field apron. Its 23 m reserved
clearance circle is also declared in the airport layout, keeping automatic parking out of it.
This is not an assertion about a real school or its operating schedule.

Run `molen sim run scene.json --ticks 2160 --hash` or
`molen shot scene.json --ticks 210 --out shot.png` from this directory.
The companion cargo scene uses the same small operations script with `cargo: true`.
