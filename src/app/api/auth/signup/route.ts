import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/mongodb";
import { signToken } from "@/lib/auth";
import { Profile } from "@/models/Profile";
import { randomUUID } from "crypto";

export async function POST(req: NextRequest) {
  try {
    const { email, password, name } = await req.json();
    if (!email || !password || !name) {
      return NextResponse.json(
        { error: "Email, password and name are required" },
        { status: 400 }
      );
    }
    if (password.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters" },
        { status: 400 }
      );
    }

    await connectDB();

    const existing = await Profile.findOne({ email: email.toLowerCase() });
    if (existing) {
      return NextResponse.json(
        { error: "Email already in use" },
        { status: 409 }
      );
    }

    const hashed = await bcrypt.hash(password, 10);
    const id = randomUUID();

    const profile = await Profile.create({
      _id: id,
      email: email.toLowerCase(),
      password: hashed,
      name: name.trim(),
    });

    const token = signToken({ userId: id, email: profile.email });

    return NextResponse.json({
      token,
      user: { id, email: profile.email, name: profile.name },
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
