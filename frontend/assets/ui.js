import React from "react";
import htm from "htm";

export const html = htm.bind(React.createElement);
export const { useState, useEffect, useMemo, useCallback } = React;
export { React };
