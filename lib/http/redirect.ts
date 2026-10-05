import { NextResponse } from "next/server";

export function redirectOnSameHost(path: string) {
  return new NextResponse(null, {
    status: 307,
    headers: { Location: path },
  });
}
