// WHATWG globals available in Node 18+, browsers, and Workers; declared here so the package
// stays environment-agnostic without pulling in DOM/node libs.
declare function btoa(data: string): string;
declare function atob(data: string): string;
