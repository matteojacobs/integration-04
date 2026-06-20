// src/components/RecentSubmissions.tsx

import { useEffect, useState } from "react";
import { supabase } from "../db/supabase";

type Submission = {
    id: string;
    pov_id: string;
    created_at: string;
    capture_location: string;
    decorated_image_path: string;
};

function timeAgo(dateString: string) {
    const seconds = Math.floor(
        (Date.now() - new Date(dateString).getTime()) / 1000,
    );

    if (seconds < 60) {
        return `${seconds} second${seconds !== 1 ? "s" : ""} ago`;
    }

    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) {
        return `${minutes} minute${minutes !== 1 ? "s" : ""} ago`;
    }

    const hours = Math.floor(minutes / 60);
    if (hours < 24) {
        return `${hours} hour${hours !== 1 ? "s" : ""} ago`;
    }

    const days = Math.floor(hours / 24);
    return `${days} day${days !== 1 ? "s" : ""} ago`;
}

export default function RecentSubmissions({
    initialData,
}: {
    initialData: Submission[];
}) {
    const [submissions, setSubmissions] = useState(initialData);

    useEffect(() => {
        const channel = supabase
            .channel("photo_submissions")
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "photo_submissions",
                },
                (payload) => {
                    console.log(payload);

                    if (payload.eventType === "INSERT") {
                        setSubmissions((current) => [
                            payload.new as Submission,
                            ...current.slice(0, 3),
                        ]);
                    }

                    if (payload.eventType === "UPDATE") {
                        setSubmissions((current) =>
                            current.map((submission) =>
                                submission.id === payload.new.id
                                    ? (payload.new as Submission)
                                    : submission
                            )
                        );
                    }
                },
            )
            .subscribe((status) => {
                console.log("Realtime status:", status);
            });

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    return (
        <>
            {submissions.map((submission) => (
                <li
                    key={submission.id}
                    className="submission__card"
                >
                    <article className="submission">
                        <h3 className="visually-hidden">
                            {submission.pov_id}
                        </h3>

                        <img
                            className="submission__image"
                            src={`${import.meta.env.PUBLIC_STORAGE_URL}${submission.decorated_image_path}`}
                            alt={submission.pov_id}
                            loading="lazy"
                            decoding="async"
                        />

                        <div className="submission__details">
                            {/* Upload icon */}
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="15"
                                height="17"
                                viewBox="0 0 15 17"
                                fill="none"
                            >
                                <path
                                    d="M2.25 6.75H1.5V5.25H2.25V4.5H3V3.75H3.75V3H4.5V2.25H5.25V1.5H6V0.75H6.75V0H8.25V0.75H9V1.5H9.75V2.25H10.5V3H11.25V3.75H12V4.5H12.75V5.25H13.5V6.75H12.75V7.5H11.25V6.75H10.5V6H9.75V5.25H9V12H6V5.25H5.25V6H4.5V6.75H3.75V7.5H2.25V6.75Z"
                                    fill="#E37ED4"
                                />
                                <path
                                    d="M15 14.25H0V16.5H15V14.25Z"
                                    fill="#E37ED4"
                                />
                            </svg>

                            <p className="submission__date">
                                {timeAgo(submission.created_at)}
                            </p>

                            {/* Location icon */}
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="12"
                                height="17"
                                viewBox="0 0 12 17"
                                fill="none"
                            >
                                <path
                                    d="M11.25 3.75V2.25H10.5V1.5H9.75V0.75H8.25V0H3.75V0.75H2.25V1.5H1.5V2.25H0.75V3.75H0V8.25H0.75V9.75H1.5V10.5H2.25V12H3V12.75H3.75V14.25H4.5V15H5.25V16.5H6.75V15H7.5V14.25H8.25V12.75H9V12H9.75V10.5H10.5V9.75H11.25V8.25H12V3.75H11.25ZM7.5 7.5H6.75V8.25H5.25V7.5H4.5V6.75H3.75V5.25H4.5V4.5H5.25V3.75H6.75V4.5H7.5V5.25H8.25V6.75H7.5V7.5Z"
                                    fill="#E37ED4"
                                />
                            </svg>

                            <p className="submission__location">
                                {submission.capture_location}
                            </p>
                        </div>
                    </article>
                </li>
            ))}
        </>
    );
}