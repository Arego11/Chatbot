import Subscription from '../models/subscription.model.js';
import { workflowClient } from '../config/upstash.js';
import { SERVER_URL } from '../config/env.js';
import { sendReminderEmail } from '../utils/send-email.js'; // Added import statement

export const createSubscription = async (req, res, next) => {
  try {
    const subscription = await Subscription.create({
      ...req.body,
      user: req.user._id,
    });

    // Log subscription details for debugging
    console.log('Subscription created:', subscription);

    // Ensure the user's email is populated
    await subscription.populate('user', 'email');

    // Log user's email for debugging
    console.log('User email:', subscription.user.email);

    // Send reminder email
    await sendReminderEmail({
      to: subscription.user.email,
      type: 'Subscription Created', // Ensure this matches a label in emailTemplates
      subscription,
    });

    const { workflowRunId } = await workflowClient.trigger({
      url: `${SERVER_URL}/api/v1/workflows/subscription/reminder`,
      body: {
        subscriptionId: subscription._id,
      },
      headers: {
        'content-type': 'application/json',
      },
      retries: 0,
    });

    res.status(201).json({ success: true, data: { subscription, workflowRunId } });
  } catch (e) {
    next(e);
  }
};

export const getUserSubscriptions = async (req, res, next) => {
  try {
    // Check if the user is the same as the one in the token
    if (req.user.id !== req.params.id) {
      const error = new Error('You are not the owner of this account');
      error.status = 401;
      throw error;
    }

    const subscriptions = await Subscription.find({ user: req.params.id });

    res.status(200).json({ success: true, data: subscriptions });
  } catch (e) {
    next(e);
  }
};