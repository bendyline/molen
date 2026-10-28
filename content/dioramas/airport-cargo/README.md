# Airport cargo handling

Eight strapped pallet loads, an open service shelter, a forklift carrying a pallet, and six crew.
The bounded 48-second forklift loop and 20-second walking loop use fixed simulation ticks.
The scene contains ground operations only; Earth supplies nearby boardable aircraft separately.

The catalog places this fictional activity on a mapped Boeing Field apron. Its 23 m reserved
clearance circle is also declared in the airport layout, keeping automatic parking out of it.
This is not a live cargo feed or a reconstruction of a particular operator.

Run `molen sim run scene.json --ticks 2160 --hash` or
`molen shot scene.json --ticks 210 --out shot.png` from this directory.
The companion flight-school scene uses the same small operations script with `cargo: false`.
