// Manual mock for next/server — provides NextResponse, NextRequest for tests
import { NextResponse } from "next/dist/server/web/spec-extension/response";
import { NextRequest } from "next/dist/server/web/spec-extension/request";

export { NextResponse, NextRequest };
